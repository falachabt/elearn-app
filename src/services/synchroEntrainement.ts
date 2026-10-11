import type { SupabaseClient } from '@supabase/supabase-js';

import { appliquerProgressionEntrainement, lireDatesExercices, lireProgressionEntrainement, type ProgressionEntrainement } from './entrainement';
import { abonnerProgressionLocale } from './progressionLocale';
import { repriseInviteEnCours } from './repriseInvite';

type Client = Pick<SupabaseClient, 'rpc'>;

function estProgression(valeur: unknown): valeur is ProgressionEntrainement {
  if (!valeur || typeof valeur !== 'object') return false;
  const p = valeur as Partial<ProgressionEntrainement>;
  return !!p.quiz_scores && typeof p.quiz_scores === 'object'
    && !!p.exercises_done && typeof p.exercises_done === 'object'
    && !!p.quiz_sessions && typeof p.quiz_sessions === 'object';
}

/** Fusionne les scores, exercices terminés et dix dernières sessions par quiz avec l'état du compte. */
export async function synchroniserEntrainement(client: Client, forcer = false): Promise<boolean> {
  if (!forcer && repriseInviteEnCours()) return false;
  const locale = await lireProgressionEntrainement();
  // Dates des exercices terminés sur cet appareil (récap « Ma semaine ») : seulement ceux qui sont encore faits.
  const dates = await lireDatesExercices();
  const exercise_dates = Object.fromEntries(Object.entries(dates).filter(([id]) => locale.exercises_done[id]));
  const { data, error } = await client.rpc('sync_my_practice_progress', { p_progress: { ...locale, exercise_dates } });
  if (error) throw error;
  if (!estProgression(data)) throw new Error('Le serveur a renvoyé une progression d’entraînement illisible.');
  await appliquerProgressionEntrainement(data);
  return true;
}

/** Envoie les changements locaux avec temporisation et remonte explicitement les erreurs réseau. */
export function suivreProgressionEntrainement(client: Client, delaiMs = 800): () => void {
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  const arreter = abonnerProgressionLocale(() => {
    if (minuteur) clearTimeout(minuteur);
    minuteur = setTimeout(() => {
      void synchroniserEntrainement(client).catch((erreur: unknown) => {
        console.warn('La synchronisation des entraînements a échoué.', erreur);
      });
    }, delaiMs);
  });
  return () => {
    if (minuteur) clearTimeout(minuteur);
    arreter();
  };
}
