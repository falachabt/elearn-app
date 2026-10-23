import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import { suivre } from './analytics';
import { garderNotifications, lireNotificationsGardees, type Notification } from './notifications';

export type SourceXp = 'quiz' | 'daily_mission' | 'course' | 'exercise' | 'exam' | 'feed_post' | 'feed_comment';

export interface PalierNiveau {
  niveau: number;
  nomCleI18n: string;
  seuilMin: number;
  seuilSuivant: number | null;
  couleur: string; // Token ou couleur de palier
}

/**
 * 10 Paliers de niveaux avec chacun sa couleur unique et distincte (M4-07).
 * Couleurs issues de la palette du design system :
 * - Niveau 1 (Débutant) : Lilas 400 (#B69CFF)
 * - Niveau 2 (Apprenti) : Menthe 400 (#8FD2C1)
 * - Niveau 3 (Initié)   : Herbe 400 (#7BC74D)
 * - Niveau 4 (Assidu)   : Émeraude 500 (#10B981)
 * - Niveau 5 (Expert)   : Bleu azur 400 (#5B9BFF)
 * - Niveau 6 (Major)    : Bleu roi 500 (#1A75FF)
 * - Niveau 7 (Virtuose) : Rose 400 (#FF8FB1)
 * - Niveau 8 (Mentor)   : Orange 400 (#FF9A3D)
 * - Niveau 9 (Maître)   : Corail vif 500 (#FF5A4F)
 * - Niveau 10 (Légende) : Or Soleil 400 (#FFD83D)
 */
export const PALIERS_NIVEAU: readonly PalierNiveau[] = [
  { niveau: 1, nomCleI18n: 'xp.palier1', seuilMin: 0, seuilSuivant: 100, couleur: '#B69CFF' },
  { niveau: 2, nomCleI18n: 'xp.palier2', seuilMin: 100, seuilSuivant: 250, couleur: '#8FD2C1' },
  { niveau: 3, nomCleI18n: 'xp.palier3', seuilMin: 250, seuilSuivant: 500, couleur: '#7BC74D' },
  { niveau: 4, nomCleI18n: 'xp.palier4', seuilMin: 500, seuilSuivant: 1000, couleur: '#10B981' },
  { niveau: 5, nomCleI18n: 'xp.palier5', seuilMin: 1000, seuilSuivant: 2000, couleur: '#5B9BFF' },
  { niveau: 6, nomCleI18n: 'xp.palier6', seuilMin: 2000, seuilSuivant: 3500, couleur: '#1A75FF' },
  { niveau: 7, nomCleI18n: 'xp.palier7', seuilMin: 3500, seuilSuivant: 5500, couleur: '#FF8FB1' },
  { niveau: 8, nomCleI18n: 'xp.palier8', seuilMin: 5500, seuilSuivant: 8000, couleur: '#FF9A3D' },
  { niveau: 9, nomCleI18n: 'xp.palier9', seuilMin: 8000, seuilSuivant: 12000, couleur: '#FF5A4F' },
  { niveau: 10, nomCleI18n: 'xp.palier10', seuilMin: 12000, seuilSuivant: null, couleur: '#FFD83D' },
] as const;

/** Barème public d'attribution de l'effort (M4-07). */
export const BAREME_XP = [
  { source: 'quiz', gain: 10, cleI18n: 'xp.baremeQuiz' },
  { source: 'daily_mission', gain: 50, cleI18n: 'xp.baremeMission' },
  { source: 'course', gain: 20, cleI18n: 'xp.baremeCourse' },
  { source: 'exercise', gain: 15, cleI18n: 'xp.baremeExercise' },
  { source: 'exam', gain: 100, cleI18n: 'xp.baremeExam' },
  { source: 'feed_post', gain: 5, cleI18n: 'xp.baremeFeedPost' },
  { source: 'feed_comment', gain: 10, cleI18n: 'xp.baremeFeedComment' },
] as const;

export interface InfoNiveau {
  niveau: number;
  nomCleI18n: string;
  totalXp: number;
  seuilMin: number;
  seuilSuivant: number | null;
  xpActuelDansNiveau: number;
  xpRequisPourSuivant: number;
  ratioProgression: number; // de 0 à 1 (pourcentage pour la jauge)
  couleur: string;
}

/** Calcule le niveau et la progression circulaire à partir du total XP. */
export function calculerNiveau(totalXp: number): InfoNiveau {
  const xp = Math.max(0, Math.floor(totalXp || 0));

  let palierActuel: PalierNiveau = PALIERS_NIVEAU[0];
  for (let i = PALIERS_NIVEAU.length - 1; i >= 0; i--) {
    if (xp >= PALIERS_NIVEAU[i].seuilMin) {
      palierActuel = PALIERS_NIVEAU[i];
      break;
    }
  }

  if (palierActuel.seuilSuivant === null) {
    // Palier max atteint (Légende)
    return {
      niveau: palierActuel.niveau,
      nomCleI18n: palierActuel.nomCleI18n,
      totalXp: xp,
      seuilMin: palierActuel.seuilMin,
      seuilSuivant: null,
      xpActuelDansNiveau: xp - palierActuel.seuilMin,
      xpRequisPourSuivant: 0,
      ratioProgression: 1,
      couleur: palierActuel.couleur,
    };
  }

  const tranche = palierActuel.seuilSuivant - palierActuel.seuilMin;
  const acquis = xp - palierActuel.seuilMin;
  const ratio = Math.min(1, Math.max(0, tranche > 0 ? acquis / tranche : 0));

  return {
    niveau: palierActuel.niveau,
    nomCleI18n: palierActuel.nomCleI18n,
    totalXp: xp,
    seuilMin: palierActuel.seuilMin,
    seuilSuivant: palierActuel.seuilSuivant,
    xpActuelDansNiveau: acquis,
    xpRequisPourSuivant: palierActuel.seuilSuivant - xp,
    ratioProgression: ratio,
    couleur: palierActuel.couleur,
  };
}

export const CLE_XP_LOCAL = 'xp.totalLocal';
// Gains gagnés hors ligne (ou pendant un échec d'envoi) en attente d'écriture dans xp_history. Sans cette file,
// un gain n'existait que dans le cache local et la lecture du total serveur à la reconnexion l'effaçait
// (retour terrain du 23 octobre 2026 : +40 XP de leçons perdues, 910 revenu à 870).
export const CLE_XP_EN_ATTENTE = 'xp.gainsEnAttente';

type GainXpEnAttente = {
  userId: string;
  gain: number;
  source?: string;
  sourceId?: string;
  le: string;
};

async function lireGainsEnAttente(): Promise<GainXpEnAttente[]> {
  try {
    const brut = await AsyncStorage.getItem(CLE_XP_EN_ATTENTE);
    const liste = brut ? (JSON.parse(brut) as GainXpEnAttente[]) : [];
    return Array.isArray(liste) ? liste : [];
  } catch {
    return [];
  }
}

async function ecrireGainsEnAttente(liste: GainXpEnAttente[]): Promise<void> {
  try {
    if (liste.length === 0) await AsyncStorage.removeItem(CLE_XP_EN_ATTENTE);
    else await AsyncStorage.setItem(CLE_XP_EN_ATTENTE, JSON.stringify(liste));
  } catch {
    // Si l'appareil ne peut même plus écrire localement, le total local reste la meilleure trace disponible.
  }
}

function sommeGainsEnAttente(liste: GainXpEnAttente[], userId: string): number {
  return liste.filter((g) => g.userId === userId).reduce((s, g) => s + g.gain, 0);
}

// Écrit un gain dans xp_history (le trigger `update_user_xp` met à jour le total serveur). PostgREST RENVOIE
// ses erreurs sans les lever : le résultat est testé explicitement, sinon l'échec passerait inaperçu.
async function envoyerGain(client: Client, gain: GainXpEnAttente): Promise<boolean> {
  try {
    const historique = client.from('xp_history');
    if (typeof historique?.insert !== 'function') return false;
    const res = await historique.insert({
      userid: gain.userId,
      xp_gained: gain.gain,
      source_type: 'quiz',
      source_id: gain.sourceId ?? gain.source ?? 0,
    } as never);
    return !(res as { error?: unknown } | undefined)?.error;
  } catch {
    return false;
  }
}

type Client = Pick<SupabaseClient, 'from'>;

/**
 * Lit les XP de l'élève connecté dans `public.user_xp`.
 * Les XP de l'ancienne application sont ainsi repris et conservés.
 * Replie sur le cache local en mode hors ligne ou invité.
 */
/** Le total ne bouge qu'à un gain d'XP : une lecture récente suffit pour les écrans qui s'affichent en rafale (issue #14). */
const DUREE_CACHE_XP_MS = 60 * 1000;
let lectureXpRecente: { userId: string; valeur: number; date: number } | null = null;

/** Pour les tests : oublie la dernière lecture distante. */
export function reinitialiserCacheXp(): void {
  lectureXpRecente = null;
}

export async function lireUserXp(client?: Client | null, userId?: string | null): Promise<number> {
  const localBrut = await AsyncStorage.getItem(CLE_XP_LOCAL).catch(() => null);
  const local = localBrut ? Math.max(0, parseInt(localBrut, 10) || 0) : 0;

  if (client && typeof client.from === 'function' && userId) {
    if (lectureXpRecente && lectureXpRecente.userId === userId && Date.now() - lectureXpRecente.date < DUREE_CACHE_XP_MS) {
      return lectureXpRecente.valeur;
    }
    try {
      const { data, error } = await client.from('user_xp').select('total_xp').eq('userid', userId).maybeSingle();
      if (!error && data && typeof (data as { total_xp: number }).total_xp === 'number') {
        const distant = (data as { total_xp: number }).total_xp;
        // Le serveur fait foi pour ce qu'il connaît, PLUS les gains encore en attente d'envoi : sinon la
        // reconnexion écraserait l'affichage (910 revenu à 870) alors que les leçons sont bien terminées.
        const total = distant + sommeGainsEnAttente(await lireGainsEnAttente(), userId);
        lectureXpRecente = { userId, valeur: total, date: Date.now() };
        await AsyncStorage.setItem(CLE_XP_LOCAL, String(total)).catch(() => {});
        return total;
      }
    } catch {
      // Repli sur le stockage local ci-dessous
    }
  }

  return local;
}

const creditationsEnCours = new Set<string>();

/** Réinitialise les verrous en mémoire (utile entre chaque test). */
export function reinitialiserVerrousCreditation(): void {
  creditationsEnCours.clear();
}

/**
 * Crédite des points d'XP :
 * - Persiste localement pour affichage et calcul instantané.
 * - Écrit dans `public.xp_history` et met à jour `user_xp` sur Supabase si connecté.
 * - Trace l'événement PostHog `xp_earned`.
 */
export async function crediterXp(
  client?: Client | null,
  userId?: string | null,
  gain = 0,
  source: SourceXp = 'quiz',
  sourceId?: string,
): Promise<number> {
  if (gain <= 0) {
    return lireUserXp(client, userId);
  }

  // Anti-rebond en mémoire : empêche qu'une même action soit créditée deux fois en cas de double clic
  const identifiantAction = sourceId ?? (source === 'daily_mission' ? new Date().toISOString().slice(0, 10) : undefined);
  if (identifiantAction) {
    const cleRebond = `${userId ?? 'anonyme'}_${source}_${identifiantAction}`;
    if (creditationsEnCours.has(cleRebond)) {
      return lireUserXp(client, userId);
    }
    creditationsEnCours.add(cleRebond);
    setTimeout(() => creditationsEnCours.delete(cleRebond), 4000);
  }

  // Barrière absolue pour la mission du jour : 1 seule fois par jour calendaire
  if (source === 'daily_mission') {
    const jourCle = sourceId ?? new Date().toISOString().slice(0, 10);
    const cleStockage = `xp.mission_creditee_${userId ?? 'anonyme'}_${jourCle}`;
    const deja = await AsyncStorage.getItem(cleStockage).catch(() => null);
    if (deja === '1') {
      return lireUserXp(client, userId);
    }
    await AsyncStorage.setItem(cleStockage, '1').catch(() => {});
  }

  const actuel = await lireUserXp(client, userId);
  const nouveauTotal = actuel + gain;
  await AsyncStorage.setItem(CLE_XP_LOCAL, String(nouveauTotal)).catch(() => {});

  if (client && typeof client.from === 'function' && userId) {
    const envoye = await envoyerGain(client, { userId, gain, source, sourceId, le: new Date().toISOString() });
    if (envoye) {
      // Synchronisation directe de user_xp pour garantir que l'élève ne soit jamais bloqué
      const q = client.from('user_xp');
      lectureXpRecente = null;
      if (typeof q?.upsert === 'function') {
        try {
          await q.upsert({
            userid: userId,
            total_xp: nouveauTotal,
          });
        } catch {
          // L'historique est écrit et le trigger serveur suit : cet ajustement direct est un plus.
        }
      }
    } else {
      // Hors ligne ou échec d'envoi : le gain part en file d'attente et sera rejoué à la reconnexion
      // (synchroniserXp) au lieu d'être perdu à la prochaine lecture du total serveur.
      const liste = await lireGainsEnAttente();
      liste.push({ userId, gain, source, sourceId, le: new Date().toISOString() });
      await ecrireGainsEnAttente(liste);
      lectureXpRecente = { userId, valeur: nouveauTotal, date: Date.now() };
    }
  }

  notifierXpGagne(gain, nouveauTotal, source);
  return nouveauTotal;
}

/**
 * Rejoue les gains XP en attente pour ce compte (appelé à la connexion et au démarrage, comme les autres
 * synchronisations). Avant chaque envoi, l'historique serveur est consulté : si le gain y figure déjà
 * (l'envoi initial avait abouti malgré l'erreur vue par l'app), il n'est pas recrédité. Arrêt au premier
 * échec : la file est conservée pour la prochaine connexion.
 */
export async function synchroniserXp(client?: Client | null, userId?: string | null): Promise<void> {
  if (!client || typeof client.from !== 'function' || !userId) return;
  const liste = await lireGainsEnAttente();
  const miens = liste.filter((g) => g.userId === userId);
  if (miens.length === 0) return;

  const restants: GainXpEnAttente[] = [];
  let echec = false;
  let envoyes = 0;
  for (const gain of miens) {
    if (echec) {
      restants.push(gain);
      continue;
    }
    let dejaLa = false;
    if (gain.sourceId != null) {
      try {
        const requete = client.from('xp_history').select('id');
        const filtre = typeof requete?.eq === 'function' ? requete.eq('userid', userId).eq('source_id', gain.sourceId) : null;
        const res = filtre && typeof filtre.limit === 'function' ? await filtre.limit(1) : null;
        const lignes = (res as { data?: unknown[] } | null)?.data;
        dejaLa = Array.isArray(lignes) && lignes.length > 0;
      } catch {
        dejaLa = false;
      }
    }
    if (dejaLa || (await envoyerGain(client, gain))) envoyes += 1;
    else {
      echec = true;
      restants.push(gain);
    }
  }

  await ecrireGainsEnAttente([...liste.filter((g) => g.userId !== userId), ...restants]);

  if (envoyes > 0 && !echec) {
    // Les gains rejoués sont maintenant dans le total serveur : le cache local se resynchronise dessus.
    try {
      const { data, error } = await client.from('user_xp').select('total_xp').eq('userid', userId).maybeSingle();
      if (!error && data && typeof (data as { total_xp: number }).total_xp === 'number') {
        const distant = (data as { total_xp: number }).total_xp;
        await AsyncStorage.setItem(CLE_XP_LOCAL, String(distant)).catch(() => {});
        lectureXpRecente = { userId, valeur: distant, date: Date.now() };
      }
    } catch {
      // Le total local reste la meilleure trace disponible.
    }
  }
}

export type InfoGainXp = {
  gain: number;
  total: number;
  source: SourceXp | string;
};

type AuditeurGainXp = (info: InfoGainXp) => void;
const auditeursGainXp: Set<AuditeurGainXp> = new Set();

/** Permet à l'application d'écouter les gains d'XP en temps réel (ex: pour afficher un toast). */
export function ecouterGainXp(auditeur: AuditeurGainXp): () => void {
  auditeursGainXp.add(auditeur);
  return () => {
    auditeursGainXp.delete(auditeur);
  };
}

/** Émet l'événement de gain XP à tous les auditeurs actifs. */
export function emettreGainXp(info: InfoGainXp): void {
  for (const auditeur of auditeursGainXp) {
    try {
      auditeur(info);
    } catch (err) {
      console.warn('Erreur dans un auditeur de gain XP.', err);
    }
  }
}

/**
 * Notifie l'événement PostHog après un gain d'XP et déclenche les auditeurs d'UI.
 */
export function notifierXpGagne(gain: number, totalApresGain: number, source: SourceXp | string): void {
  const info = calculerNiveau(totalApresGain);
  suivre('xp_earned', {
    gain,
    total: totalApresGain,
    source,
    niveau: info.niveau,
  });
  emettreGainXp({ gain, total: totalApresGain, source });
}

/**
 * Enregistre une notification dans le centre de notifications (table `notifications` Supabase et stockage local)
 * lors d'un passage de niveau, sans notification push/FCM système lorsque l'appareil est actif.
 */
export async function enregistrerNotificationNiveau(
  client?: Client | null,
  userId?: string | null,
  niveau = 1,
  titre?: string,
  corps?: string,
): Promise<void> {
  const t = titre ?? `Niveau ${niveau} débloqué !`;
  const c = corps ?? `Félicitations, tu viens d’atteindre le niveau ${niveau} !`;

  // 1. Enregistrement distant sur Supabase si connecté
  if (client && typeof client.from === 'function' && userId) {
    try {
      await client.from('notifications').insert({
        user_id: userId,
        type: 'level_up',
        title: t,
        body: c,
        data: { screen: '/xp', niveau },
      });
    } catch (err) {
      console.warn('Impossible d’insérer la notification level_up sur Supabase.', err);
    }
  }

  // 2. Enregistrement dans la liste gardée en local pour affichage immédiat
  if (userId) {
    try {
      const gardees = (await lireNotificationsGardees(userId)) ?? [];
      const idNotif = `level_up_${niveau}`;
      // On évite d'ajouter un doublon pour le même niveau
      if (!gardees.some((n) => n.id === idNotif || (n.type === 'level_up' && (n.data as { niveau?: number })?.niveau === niveau))) {
        const nouvelle: Notification = {
          id: idNotif,
          type: 'level_up',
          titre: t,
          corps: c,
          data: { screen: '/xp', niveau },
          lue: false,
          creeLe: new Date().toISOString(),
        };
        await garderNotifications(userId, [nouvelle, ...gardees]);
      }
    } catch {
      // Ne bloque jamais
    }
  }
}
