import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

type ClientFil = Pick<SupabaseClient, 'rpc'>;
type ClientPoster = Pick<SupabaseClient, 'from'>;

export type Question = {
  id: string;
  auteurId: string;
  auteur: string;
  /** Une réponse de l'IA est déjà publiée. */
  ia: boolean;
  texte: string;
  photos: string[];
  matiere: string | null;
  classe: string | null;
  creeLe: string;
  reponses: number;
  resolue: boolean;
  miennes: boolean;
  /** Signalée : masquée en attente d'examen (visible seulement par son auteur). */
  masquee: boolean;
};
export type FiltresFil = { matiere?: string | null; classe?: string | null; resolues?: boolean };

/** Matières proposées dans le fil et à la saisie ; le libellé est stocké tel quel sur la question. */
export const MATIERES_FIL = ['Maths', 'Physique-Chimie', 'SVT', 'Français', 'Anglais', 'Histoire-Géo', 'Philo'] as const;
/** Motifs proposés dans la feuille de signalement (G4) → motif enregistré. */
export const MOTIFS_SIGNALEMENT = [
  { cle: 'deplace', motif: 'inapproprie' },
  { cle: 'donnees', motif: 'numero_personnel' },
  { cle: 'horsSujet', motif: 'hors_sujet' },
] as const;
export type MotifSignalement = 'inapproprie' | 'harcelement' | 'numero_personnel' | 'hors_sujet' | 'autre';

export const TAILLE_PAGE = 20;
export const LONGUEUR_MAX = 1000;
export const LONGUEUR_MIN = 10;
export const MOTIFS: readonly MotifSignalement[] = ['inapproprie', 'harcelement', 'numero_personnel', 'hors_sujet', 'autre'];

export const cleFil = (f: FiltresFil) => `questions.fil.${f.classe ?? '*'}.${f.matiere ?? '*'}${f.resolues ? '.ok' : ''}`;

type Ligne = {
  id: string; author_id: string; author_name: string | null; has_ai: boolean; content: string; media_urls: string[] | null; subject: string | null; class_level: string | null;
  created_at: string; answers_count: number | string; resolved: boolean; mine: boolean; hidden: boolean;
};

export function versQuestion(l: Ligne): Question {
  return {
    id: l.id, auteurId: l.author_id, auteur: l.author_name ?? '', ia: l.has_ai, texte: l.content, photos: l.media_urls ?? [], matiere: l.subject, classe: l.class_level,
    creeLe: l.created_at, reponses: Number(l.answers_count), resolue: l.resolved, miennes: l.mine, masquee: !!l.hidden,
  };
}

/**
 * Une page du fil. La première page (sans `avant`) est gardée sur le téléphone : au retour sur l'onglet l'écran
 * peut afficher la copie tout de suite (`lireCopieFil`), puis se rafraîchir. Hors ligne, la copie est servie.
 */
export async function lireFil(client: ClientFil, f: FiltresFil = {}, avant: string | null = null): Promise<{ questions: Question[]; copie: boolean }> {
  try {
    const { data, error } = await client.rpc('questions_feed', {
      p_subject: f.matiere ?? null, p_class: f.classe ?? null, p_before: avant, p_limit: TAILLE_PAGE, p_resolved_only: !!f.resolues,
    });
    if (error) throw error;
    const questions = ((data ?? []) as Ligne[]).map(versQuestion);
    if (!avant) await AsyncStorage.setItem(cleFil(f), JSON.stringify(questions));
    return { questions, copie: false };
  } catch (e) {
    if (!avant) {
      const copie = await lireCopieFil(f);
      if (copie) return { questions: copie, copie: true };
    }
    throw e;
  }
}

export async function lireQuestion(client: ClientFil, id: string): Promise<Question | null> {
  const { data, error } = await client.rpc('question_detail', { p_post: id });
  if (error) throw error;
  const ligne = ((data ?? []) as Ligne[])[0];
  return ligne ? versQuestion(ligne) : null;
}

export async function lireCopieFil(f: FiltresFil = {}): Promise<Question[] | null> {
  const brut = await AsyncStorage.getItem(cleFil(f));
  return brut ? (JSON.parse(brut) as Question[]) : null;
}

/** Texte d'une question : nettoyé, 10 à 1000 caractères. `null` si valide, sinon la raison. */
export function erreurTexte(texte: string): 'trop_court' | 'trop_long' | null {
  const n = texte.trim().length;
  return n < LONGUEUR_MIN ? 'trop_court' : n > LONGUEUR_MAX ? 'trop_long' : null;
}

/** Publie une question. Les numéros de téléphone sont masqués côté serveur (M7-05). */
export async function poserQuestion(client: ClientPoster, q: { texte: string; matiere?: string | null; classe?: string | null; photos?: string[] }): Promise<string> {
  const erreur = erreurTexte(q.texte);
  if (erreur) throw new Error(erreur);
  const { data, error } = await client
    .from('feed_posts')
    .insert({ content: q.texte.trim(), subject: q.matiere ?? null, class_level: q.classe ?? null, media_urls: q.photos ?? [] })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Signale une question ou une réponse : elle est masquée en attendant la décision (M7-04). */
export async function signaler(client: ClientFil, type: 'post' | 'comment', id: string, motif: MotifSignalement, details?: string): Promise<void> {
  const { error } = await client.rpc('report_content', { p_type: type, p_id: id, p_reason: motif, p_details: details ?? null });
  if (error) throw error;
}

/** Page suivante : date de la dernière question reçue, `null` quand la page était incomplète. */
export function curseurSuivant(page: readonly Question[]): string | null {
  return page.length === TAILLE_PAGE ? page[page.length - 1].creeLe : null;
}

export type Reponse = {
  id: string;
  parentId: string | null;
  auteur: string;
  ia: boolean;
  enseignant: boolean;
  meilleure: boolean;
  texte: string;
  photos: string[];
  score: number;
  monVote: -1 | 0 | 1;
  miennes: boolean;
  masquee: boolean;
  creeLe: string;
};
type LigneReponse = {
  id: string; parent_id: string | null; author_name: string | null; is_ai: boolean; is_teacher: boolean; is_best: boolean;
  content: string; media_urls: string[] | null; score: number; my_vote: number | null; mine: boolean; hidden: boolean; created_at: string;
};

export const cleReponses = (id: string) => `questions.reponses.${id}`;

/** Réponses d'une question dans l'ordre d'affichage (IA, meilleure, votes, date) ; copie locale hors ligne. */
export async function lireReponses(client: ClientFil, id: string): Promise<Reponse[]> {
  try {
    const { data, error } = await client.rpc('question_replies', { p_post: id });
    if (error) throw error;
    const reponses = ((data ?? []) as LigneReponse[]).map(
      (l): Reponse => ({
        id: l.id, parentId: l.parent_id, auteur: l.author_name ?? '', ia: l.is_ai, enseignant: l.is_teacher, meilleure: l.is_best,
        texte: l.content, photos: l.media_urls ?? [], score: l.score, monVote: (l.my_vote ?? 0) as -1 | 0 | 1, miennes: l.mine, masquee: !!l.hidden, creeLe: l.created_at,
      }),
    );
    await AsyncStorage.setItem(cleReponses(id), JSON.stringify(reponses));
    return reponses;
  } catch (e) {
    const copie = await AsyncStorage.getItem(cleReponses(id));
    if (copie) return JSON.parse(copie) as Reponse[];
    throw e;
  }
}

/** Réponses de premier niveau, chacune suivie de ses réponses (un seul niveau d'imbrication, maquette G3). */
export function fil(reponses: readonly Reponse[]): { reponse: Reponse; suites: Reponse[] }[] {
  const ids = new Set(reponses.map((r) => r.id));
  const haut = reponses.filter((r) => !r.parentId || !ids.has(r.parentId));
  return haut.map((reponse) => ({ reponse, suites: reponses.filter((r) => r.parentId === reponse.id) }));
}

/** Vote +1 ou -1 ; un second appui identique l'annule. Renvoie le nouveau score. */
export async function voter(client: ClientFil, id: string, vote: 1 | -1): Promise<number> {
  const { data, error } = await client.rpc('vote_reply', { p_comment: id, p_vote: vote });
  if (error) throw error;
  return Number(data);
}

/** Vote appliqué à la liste sans attendre le serveur (même règle que `vote_reply`). */
export function appliquerVote(r: Reponse, vote: 1 | -1): Reponse {
  const nouveau = r.monVote === vote ? 0 : vote;
  return { ...r, monVote: nouveau, score: r.score - r.monVote + nouveau };
}

/** L'auteur de la question choisit la meilleure réponse (`null` pour la retirer). */
export async function choisirMeilleure(client: ClientFil, questionId: string, reponseId: string | null): Promise<void> {
  const { error } = await client.rpc('set_best_answer', { p_post_id: questionId, p_comment_id: reponseId });
  if (error) throw error;
}

/** « il y a 12 min » : clé de traduction et nombre. */
export function ilYa(iso: string, maintenant: number = Date.now()): { cle: 'maintenant' | 'minutes' | 'heures' | 'jours'; n: number } {
  const min = Math.max(0, Math.floor((maintenant - new Date(iso).getTime()) / 60000));
  if (min < 1) return { cle: 'maintenant', n: 0 };
  if (min < 60) return { cle: 'minutes', n: min };
  if (min < 1440) return { cle: 'heures', n: Math.floor(min / 60) };
  return { cle: 'jours', n: Math.floor(min / 1440) };
}

/** Même règle que le serveur (8 chiffres ou plus, séparés ou non) : sert à prévenir avant l'envoi. */
const NUMERO = /\+?\d(?:[ .-]?\d){7,}/g;
export const contientNumero = (texte: string): boolean => new RegExp(NUMERO.source).test(texte);
export const masquerNumeros = (texte: string): string => texte.replace(NUMERO, '••• ••• •••');

/** Un seul niveau d'imbrication : répondre à une réponse imbriquée rattache la réponse à son parent. */
export function parentPourReponse(reponses: readonly Reponse[], cibleId: string | null): string | null {
  if (!cibleId) return null;
  const cible = reponses.find((r) => r.id === cibleId);
  return cible?.parentId ?? cibleId;
}

export type Sortie = { cle: string; questionId: string; texte: string; parentId: string | null; photo: string | null; statut: 'envoi' | 'echec' };
const CLE_SORTIE = 'questions.sortie';

async function lireToutesSorties(): Promise<Sortie[]> {
  try {
    const brut = await AsyncStorage.getItem(CLE_SORTIE);
    return brut ? (JSON.parse(brut) as Sortie[]) : [];
  } catch {
    return [];
  }
}
const ecrireSorties = (s: Sortie[]) => AsyncStorage.setItem(CLE_SORTIE, JSON.stringify(s));

/** Réponses pas encore parties (envoi en cours ou échec) : le texte n'est jamais perdu. */
export async function lireSorties(questionId: string): Promise<Sortie[]> {
  return (await lireToutesSorties()).filter((s) => s.questionId === questionId);
}

export async function ajouterSortie(s: Omit<Sortie, 'cle' | 'statut'>): Promise<Sortie> {
  const sortie: Sortie = { ...s, cle: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, statut: 'envoi' };
  await ecrireSorties([...(await lireToutesSorties()), sortie]);
  return sortie;
}

export async function retirerSortie(cle: string): Promise<void> {
  await ecrireSorties((await lireToutesSorties()).filter((s) => s.cle !== cle));
}

async function marquerSortie(cle: string, statut: Sortie['statut']): Promise<void> {
  await ecrireSorties((await lireToutesSorties()).map((s) => (s.cle === cle ? { ...s, statut } : s)));
}

type ClientReponse = Pick<SupabaseClient, 'from' | 'storage'>;

async function envoyerPhoto(client: ClientReponse, uri: string, userId: string): Promise<string> {
  const octets = await (await fetch(uri)).arrayBuffer();
  const chemin = `${userId}/${Date.now()}.jpg`;
  const { error } = await client.storage.from('feed-media').upload(chemin, octets, { contentType: 'image/jpeg' });
  if (error) throw error;
  return client.storage.from('feed-media').getPublicUrl(chemin).data.publicUrl;
}

/**
 * Envoie une réponse en attente. Succès : elle quitte la file. Échec : elle reste, marquée « echec », prête pour
 * « Réessayer ». Les numéros sont masqués par le serveur (M7-05) ; le client prévient avant (`contientNumero`).
 */
export async function envoyerSortie(client: ClientReponse, s: Sortie, userId: string): Promise<boolean> {
  try {
    const photos = s.photo ? [await envoyerPhoto(client, s.photo, userId)] : [];
    const { error } = await client
      .from('post_comments')
      .insert({ post_id: s.questionId, content: s.texte.trim(), parent_comment_id: s.parentId, media_urls: photos });
    if (error) throw error;
    await retirerSortie(s.cle);
    return true;
  } catch {
    await marquerSortie(s.cle, 'echec');
    return false;
  }
}

/** À la reconnexion (retour sur l'écran) : renvoie les réponses de cette question restées en file. */
export async function envoyerSortiesEnAttente(client: ClientReponse, questionId: string, userId: string): Promise<number> {
  let envoyees = 0;
  for (const s of await lireSorties(questionId)) {
    if (await envoyerSortie(client, s, userId)) envoyees += 1;
  }
  return envoyees;
}
