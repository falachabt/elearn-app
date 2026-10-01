import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

type ClientFil = Pick<SupabaseClient, 'rpc'>;
type ClientPoster = Pick<SupabaseClient, 'from'>;

export type Question = {
  id: string;
  auteurId: string;
  texte: string;
  photos: string[];
  matiere: string | null;
  classe: string | null;
  creeLe: string;
  reponses: number;
  resolue: boolean;
  miennes: boolean;
};
export type FiltresFil = { matiere?: string | null; classe?: string | null };
export type MotifSignalement = 'inapproprie' | 'harcelement' | 'numero_personnel' | 'hors_sujet' | 'autre';

export const TAILLE_PAGE = 20;
export const LONGUEUR_MAX = 1000;
export const LONGUEUR_MIN = 10;
export const MOTIFS: readonly MotifSignalement[] = ['inapproprie', 'harcelement', 'numero_personnel', 'hors_sujet', 'autre'];

export const cleFil = (f: FiltresFil) => `questions.fil.${f.classe ?? '*'}.${f.matiere ?? '*'}`;

type Ligne = {
  id: string; author_id: string; content: string; media_urls: string[] | null; subject: string | null; class_level: string | null;
  created_at: string; answers_count: number | string; resolved: boolean; mine: boolean;
};

export function versQuestion(l: Ligne): Question {
  return {
    id: l.id, auteurId: l.author_id, texte: l.content, photos: l.media_urls ?? [], matiere: l.subject, classe: l.class_level,
    creeLe: l.created_at, reponses: Number(l.answers_count), resolue: l.resolved, miennes: l.mine,
  };
}

/**
 * Une page du fil. La première page (sans `avant`) est gardée sur le téléphone : au retour sur l'onglet l'écran
 * peut afficher la copie tout de suite (`lireCopieFil`), puis se rafraîchir. Hors ligne, la copie est servie.
 */
export async function lireFil(client: ClientFil, f: FiltresFil = {}, avant: string | null = null): Promise<Question[]> {
  try {
    const { data, error } = await client.rpc('questions_feed', {
      p_subject: f.matiere ?? null, p_class: f.classe ?? null, p_before: avant, p_limit: TAILLE_PAGE,
    });
    if (error) throw error;
    const questions = ((data ?? []) as Ligne[]).map(versQuestion);
    if (!avant) await AsyncStorage.setItem(cleFil(f), JSON.stringify(questions));
    return questions;
  } catch (e) {
    if (!avant) {
      const copie = await lireCopieFil(f);
      if (copie) return copie;
    }
    throw e;
  }
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
