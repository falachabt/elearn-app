import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Correction } from './correction';
import { ajouterJours, dimancheDe, jourEnTexte } from './maSemaine';
import type { QuestionTiree } from './miniTest';

/** Journal local des questions ratées : de quoi lister et refaire « toutes les erreurs de la semaine » (rapport hebdomadaire). */
export type ErreurJournal = { jour: string; question: QuestionTiree };

export const CLE_ERREURS_SEMAINE = 'erreurs.semaine';
/** Au-delà, les plus anciennes sont oubliées : le journal ne grossit pas sans fin sur un téléphone d'entrée de gamme. */
export const MAX_ERREURS_JOURNAL = 150;
/** Une erreur plus vieille que ça n'est plus proposée (le rapport ne garde que 8 semaines). */
export const JOURS_CONSERVES = 60;

async function lireJournal(): Promise<ErreurJournal[]> {
  try {
    const brut = await AsyncStorage.getItem(CLE_ERREURS_SEMAINE);
    const liste: unknown = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? (liste as ErreurJournal[]).filter((e) => e && typeof e.jour === 'string' && e.question?.id) : [];
  } catch {
    return [];
  }
}

/**
 * Met le journal à jour avec un quiz terminé : une question ratée ou passée y entre (ou garde son jour d'origine si elle
 * y est déjà), une question réussie en sort. « Refaire mes erreurs » passe par ici aussi : une erreur corrigée disparaît.
 */
export async function noterCorrection(c: Pick<Correction, 'questions' | 'reponses'>, maintenant = new Date()): Promise<void> {
  const aujourdhui = jourEnTexte(maintenant);
  const limite = ajouterJours(aujourdhui, -JOURS_CONSERVES);
  const existant = new Map((await lireJournal()).filter((e) => e.jour >= limite).map((e) => [e.question.id, e] as const));
  c.questions.forEach((question, i) => {
    if (c.reponses[i] === question.bonne) existant.delete(question.id);
    else existant.set(question.id, { jour: existant.get(question.id)?.jour ?? aujourdhui, question });
  });
  const liste = [...existant.values()].sort((a, b) => (a.jour < b.jour ? -1 : a.jour > b.jour ? 1 : 0)).slice(-MAX_ERREURS_JOURNAL);
  await AsyncStorage.setItem(CLE_ERREURS_SEMAINE, JSON.stringify(liste));
}

/** Les erreurs de la semaine du lundi donné (AAAA-MM-JJ), de la plus récente à la plus ancienne. */
export async function lireErreursSemaine(semaine: string): Promise<ErreurJournal[]> {
  const fin = dimancheDe(semaine);
  return (await lireJournal()).filter((e) => e.jour >= semaine && e.jour <= fin).reverse();
}

