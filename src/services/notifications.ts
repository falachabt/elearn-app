import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Notifications de l'élève (M9-05, issue #32) : cloche, centre et réglages. Tout vient du serveur
 * (migration 20261001192000_notifications_eleve) : table `notifications`, RPC de comptage, de marquage et de
 * réglages. La liste est gardée sur l'appareil pour s'afficher hors ligne (« dernières notifications connues »).
 */
export const CLE_NOTIFICATIONS = 'notifications.liste';
/** Combien de notifications le centre charge d'un coup (le serveur garde tout, l'élève ne scrolle pas plus loin). */
export const LIMITE_NOTIFICATIONS = 50;

type Client = Pick<SupabaseClient, 'rpc' | 'from'>;

export type Notification = {
  id: string;
  type: string;
  titre: string;
  corps: string;
  data: Record<string, unknown>;
  lue: boolean;
  creeLe: string;
};

type Ligne = { id: string; type: string; title: string; body: string; data: unknown; read_at: string | null; created_at: string };

/** Ligne de la table → notification de l'app (données absentes ou mal formées : objet vide). */
export function depuisLigne(l: Ligne): Notification {
  const data = l.data && typeof l.data === 'object' && !Array.isArray(l.data) ? (l.data as Record<string, unknown>) : {};
  return { id: l.id, type: l.type, titre: l.title, corps: l.body, data, lue: l.read_at != null, creeLe: l.created_at };
}

/** Les plus récentes d'abord. */
export async function lireNotifications(client: Client, limite = LIMITE_NOTIFICATIONS): Promise<Notification[]> {
  const { data, error } = await client
    .from('notifications')
    .select('id, type, title, body, data, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return ((data ?? []) as Ligne[]).map(depuisLigne);
}

export async function compterNonLues(client: Client): Promise<number> {
  const { data, error } = await client.rpc('unread_notifications_count');
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

/**
 * Marque une notification lue (idempotent : une notification déjà lue garde sa date). Passe par la fonction serveur
 * `mark_notification_read` (déjà en base, migration du fil) : la table n'a qu'une règle de lecture, un `update` direct est ignoré sans erreur (0 ligne)
 * et la notification redevenait non lue à la relecture.
 */
export async function marquerLue(client: Client, id: string): Promise<void> {
  const { error } = await client.rpc('mark_notification_read', { p_notification_id: id });
  if (error) throw error;
}

/** « Tout lire » : renvoie le nombre de notifications marquées. */
export async function toutMarquerLu(client: Client): Promise<number> {
  const { data, error } = await client.rpc('mark_all_notifications_read');
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

/** Pastille de la cloche : le nombre jusqu'à 9, « 9+ » au-delà (guide, K1). */
export function libellePastille(n: number): string {
  return n > 9 ? '9+' : String(Math.max(0, n));
}

// --- Liste gardée sur l'appareil -----------------------------------------------------------------------------------

type Copie = { pour: string; notifications: Notification[] };

export async function garderNotifications(utilisateur: string, notifications: Notification[]): Promise<void> {
  const copie: Copie = { pour: utilisateur, notifications: notifications.slice(0, LIMITE_NOTIFICATIONS) };
  await AsyncStorage.setItem(CLE_NOTIFICATIONS, JSON.stringify(copie)).catch(() => {});
}

/** Dernière liste connue de CET élève ; jamais celle d'un autre compte. */
export async function lireNotificationsGardees(utilisateur: string): Promise<Notification[] | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE_NOTIFICATIONS);
    if (!brut) return null;
    const copie = JSON.parse(brut) as Partial<Copie>;
    if (copie.pour !== utilisateur || !Array.isArray(copie.notifications)) return null;
    return copie.notifications;
  } catch {
    return null;
  }
}

// --- Temps réel ----------------------------------------------------------------------------------------------------

export type EvenementNotification = { type: 'INSERT' | 'UPDATE' | 'DELETE'; ligne: Ligne | null; ancienId: string | null };

/** S'abonne aux notifications de l'élève (pastille et centre à jour sans recharger). Renvoie la fonction d'arrêt. */
export function suivreNotifications(
  client: Pick<SupabaseClient, 'channel' | 'removeChannel'>,
  utilisateur: string,
  surEvenement: (e: EvenementNotification) => void,
): () => void {
  const canal = client
    .channel(`notifications:${utilisateur}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${utilisateur}` }, (charge) => {
      const nouvelle = charge.new as Partial<Ligne> | undefined;
      const ancienne = charge.old as Partial<Ligne> | undefined;
      surEvenement({
        type: charge.eventType as EvenementNotification['type'],
        ligne: nouvelle && typeof nouvelle.id === 'string' ? (nouvelle as Ligne) : null,
        ancienId: typeof ancienne?.id === 'string' ? ancienne.id : null,
      });
    })
    .subscribe();
  return () => {
    client.removeChannel(canal);
  };
}

/** Applique un évènement temps réel à la liste (nouvelle en tête, mise à jour sur place, suppression). */
export function appliquerEvenement(liste: Notification[], e: EvenementNotification): Notification[] {
  if (e.type === 'DELETE') return e.ancienId ? liste.filter((n) => n.id !== e.ancienId) : liste;
  if (!e.ligne) return liste;
  const n = depuisLigne(e.ligne);
  if (liste.some((x) => x.id === n.id)) return liste.map((x) => (x.id === n.id ? n : x));
  return [n, ...liste].slice(0, LIMITE_NOTIFICATIONS);
}

// --- Présentation --------------------------------------------------------------------------------------------------

export type GroupeNotifications = { cle: 'aujourdhui' | 'plusTot'; notifications: Notification[] };

/** « Aujourd'hui » : même jour local ; le reste est « Plus tôt ». Un groupe vide n'est pas rendu. */
export function grouperParJour(liste: Notification[], maintenant = new Date()): GroupeNotifications[] {
  const meme = (iso: string) => {
    const d = new Date(iso);
    return d.getFullYear() === maintenant.getFullYear() && d.getMonth() === maintenant.getMonth() && d.getDate() === maintenant.getDate();
  };
  return [
    { cle: 'aujourdhui' as const, notifications: liste.filter((n) => meme(n.creeLe)) },
    { cle: 'plusTot' as const, notifications: liste.filter((n) => !meme(n.creeLe)) },
  ].filter((g) => g.notifications.length > 0);
}

export type Delai = { unite: 'maintenant' | 'minutes' | 'heures' | 'jours'; n: number };

/** Délai écoulé, arrondi vers le bas : « à l'instant », minutes, heures, puis jours. */
export function delaiEcoule(iso: string, maintenant = new Date()): Delai {
  const minutes = Math.max(0, Math.floor((maintenant.getTime() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return { unite: 'maintenant', n: 0 };
  if (minutes < 60) return { unite: 'minutes', n: minutes };
  if (minutes < 1440) return { unite: 'heures', n: Math.floor(minutes / 60) };
  return { unite: 'jours', n: Math.floor(minutes / 1440) };
}

/** Catégorie de réglage d'un type (miroir de `notification_category` côté serveur) ; null : toujours envoyée. */
export type CategorieReglage = 'answers' | 'polls' | 'credits' | 'reminders' | 'marketing';
export function categorieDe(type: string): CategorieReglage | null {
  if (['post_comment', 'post_reply', 'mention', 'post_like', 'profile_like'].includes(type)) return 'answers';
  if (type === 'poll_revealed') return 'polls';
  if (['credits_refilled', 'referral', 'reward'].includes(type)) return 'credits';
  if (type === 'study_reminder') return 'reminders';
  if (type === 'marketing') return 'marketing';
  return null;
}

export type Destination = { pathname: string; params?: Record<string, string> };

/**
 * Écran à ouvrir au toucher d'une notification (centre ou push). Une réponse ou un sondage ouvre la question quand
 * le serveur donne `post_id` ; sinon `data.screen` (chemin interne), sinon l'écran de la catégorie. Une destination
 * inconnue renvoie vers l'accueil, jamais dans le vide.
 */
export function destinationDe(type: string, data: Record<string, unknown> | undefined): Destination {
  const postId = typeof data?.post_id === 'string' && data.post_id ? data.post_id : null;
  const ecran = typeof data?.screen === 'string' && data.screen.startsWith('/') ? data.screen : null;
  const categorie = categorieDe(type);
  // Correction par photo prête : cette correction quand l'identifiant est là (`correction_id` du serveur, `photoId` d'un
  // rappel local), sinon l'historique des corrections.
  if (type === 'photo_ready') {
    const correction = [data?.correction_id, data?.photoId, data?.photo_id, data?.id].find((v): v is string => typeof v === 'string' && v !== '');
    return { pathname: '/photo', params: correction ? { id: correction } : { historique: '1' } };
  }
  // Paiement confirmé : le détail de celui-ci quand la notification porte son identifiant, sinon la liste (Moi › Paiements).
  if (type === 'payment_confirmed') {
    const commande = typeof data?.order_id === 'string' && data.order_id ? data.order_id : null;
    return commande ? { pathname: '/paiements/[id]', params: { id: commande } } : { pathname: '/paiements' };
  }
  if ((categorie === 'answers' || categorie === 'polls') && postId) return { pathname: '/question', params: { id: postId } };
  if (ecran && ecran !== '/') return { pathname: ecran };
  if (categorie === 'answers' || categorie === 'polls') return { pathname: '/questions' };
  if (type === 'referral') return { pathname: '/parrainage' };
  // Recharge du lundi : même écran que le toucher d'un push local de recharge (Moi montre le solde).
  if (type === 'credits_refilled') return { pathname: '/moi' };
  if (categorie === 'credits') return { pathname: '/credits' };
  if (type === 'pass_ending') return { pathname: '/moi' };
  return { pathname: '/' };
}

// --- Réglages (N2) -------------------------------------------------------------------------------------------------

export type ReglagesNotifications = {
  enabled: boolean;
  answers: boolean;
  polls: boolean;
  credits: boolean;
  reminders: boolean;
  reminderHour: number;
  reminderMinute: number;
};

export const REGLAGES_PAR_DEFAUT: ReglagesNotifications = {
  enabled: true, answers: true, polls: true, credits: true, reminders: true, reminderHour: 19, reminderMinute: 0,
};

type LigneReglages = {
  enabled: boolean; answers: boolean; polls: boolean; credits: boolean; reminders: boolean; reminder_hour: number; reminder_minute: number;
};

/** Sans ligne sur le serveur, tout est activé et le rappel est à 19 h (réponse déjà complétée par la RPC). */
export async function lireReglagesNotifications(client: Client): Promise<ReglagesNotifications> {
  const { data, error } = await client.rpc('my_notification_preferences');
  if (error) throw error;
  const l = (Array.isArray(data) ? data[0] : data) as LigneReglages | null | undefined;
  if (!l) return REGLAGES_PAR_DEFAUT;
  return {
    enabled: l.enabled, answers: l.answers, polls: l.polls, credits: l.credits, reminders: l.reminders,
    reminderHour: l.reminder_hour, reminderMinute: l.reminder_minute,
  };
}

/** Enregistre les réglages donnés (les autres restent inchangés côté serveur). */
export async function ecrireReglagesNotifications(client: Client, changement: Partial<ReglagesNotifications>): Promise<void> {
  const { error } = await client.rpc('set_notification_preferences', {
    p_enabled: changement.enabled ?? null,
    p_answers: changement.answers ?? null,
    p_polls: changement.polls ?? null,
    p_credits: changement.credits ?? null,
    p_reminders: changement.reminders ?? null,
    p_reminder_hour: changement.reminderHour ?? null,
    p_reminder_minute: changement.reminderMinute ?? null,
  });
  if (error) throw error;
}
