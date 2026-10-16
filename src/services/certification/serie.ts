import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

import { obtenirApi, type PerimetreSerie } from './api';
import { CLE_SERIE, ecrireJson, lireJson } from './etat';
import { jourDe } from './jours';
import type { Reglages } from './reglages';
import type { MotCle, NotionLiee, QuestionServie, ReponseEnvoyee, ResultatReponse } from './types';

/**
 * Série d'entraînement (B1 à B7, B9, B11). La réponse est écrite sur l'appareil avant tout envoi ; le corrigé vient du
 * serveur dans la même requête. Hors ligne, la réponse reste en file (`enAttente`) et part au retour du réseau.
 */
export type EtatSerie = {
  clientUuid: string;
  exam: string;
  perimetre: PerimetreSerie;
  questions: QuestionServie[];
  index: number;
  reponses: ReponseEnvoyee[];
  /** Corrigé de chaque question répondue, par identifiant de question. */
  resultats: Record<string, ResultatReponse>;
  /** Identifiants (client_uuid) des réponses pas encore reçues par le serveur. */
  enAttente: string[];
  /** Mots ajoutés au carnet depuis le corrigé pendant cette série. */
  motsAjoutes: MotCle[];
  termine: boolean;
  /** Série lancée depuis la séance du jour (D2) : B11 ramène à D2. */
  origine?: 'seance';
};

const maintenant = () => jourDe(new Date());
const memePerimetre = (a: PerimetreSerie, b: PerimetreSerie) => (a.part ?? null) === (b.part ?? null) && (a.notion ?? null) === (b.notion ?? null) && !!a.rejeu === !!b.rejeu;

export const lireSerieEnCours = () => lireJson<EtatSerie>(CLE_SERIE);
export const ecrireSerie = (e: EtatSerie) => ecrireJson(CLE_SERIE, e);
export const effacerSerie = () => AsyncStorage.removeItem(CLE_SERIE).catch(() => {});

/** Tire une nouvelle série et remplace celle en cours. Échoue si le serveur ne répond pas : rien n'est perdu. */
export async function demarrerSerie(exam: string, perimetre: PerimetreSerie, taille?: number, origine?: 'seance'): Promise<EtatSerie> {
  const questions = await obtenirApi().lireSerie(perimetre, exam, taille);
  if (questions.length === 0) throw new Error('aucune question disponible');
  const etat: EtatSerie = { clientUuid: randomUUID(), exam, perimetre, questions, index: 0, reponses: [], resultats: {}, enAttente: [], motsAjoutes: [], termine: false, ...(origine ? { origine } : {}) };
  await ecrireSerie(etat);
  return etat;
}

/** Reprend la série en cours de même périmètre (X3 : « garder mes réponses »), sinon en tire une nouvelle. */
export async function reprendreOuDemarrer(exam: string, perimetre: PerimetreSerie, options: { taille?: number; origine?: 'seance' } = {}): Promise<EtatSerie> {
  const existante = await lireSerieEnCours();
  if (existante && !existante.termine && existante.exam === exam && memePerimetre(existante.perimetre, perimetre) && existante.origine === options.origine) return existante;
  return demarrerSerie(exam, perimetre, options.taille, options.origine);
}

/** Envoie les réponses en attente ; garde en file celles que le serveur n'a pas reçues. */
export async function envoyerEnAttente(etat: EtatSerie): Promise<EtatSerie> {
  if (etat.enAttente.length === 0) return etat;
  const lot = etat.reponses.filter((r) => etat.enAttente.includes(r.client_uuid));
  try {
    const resultats = await obtenirApi().envoyerReponses(lot);
    const suivant: EtatSerie = { ...etat, resultats: { ...etat.resultats }, enAttente: [] };
    for (const r of resultats) suivant.resultats[r.question_id] = r;
    await ecrireSerie(suivant);
    return suivant;
  } catch {
    return etat;
  }
}

/**
 * Enregistre la réponse (`null` = question passée) puis demande le corrigé. L'index n'avance pas : la question reste
 * affichée avec son corrigé jusqu'à `avancer`. Une même question ne reçoit qu'une réponse (double toucher).
 */
export async function repondreSerie(etat: EtatSerie, chosen: number | null, ms: number): Promise<EtatSerie> {
  const question = etat.questions[etat.index];
  if (!question || etat.termine) return etat;
  if (etat.reponses.some((r) => r.question_id === question.id)) return etat;
  const reponse: ReponseEnvoyee = { question_id: question.id, client_uuid: randomUUID(), chosen, ms: Math.max(0, Math.round(ms)), context: etat.perimetre.rejeu ? 'replay' : etat.origine === 'seance' ? 'session' : 'series', local_day: maintenant() };
  const local: EtatSerie = { ...etat, reponses: [...etat.reponses, reponse], enAttente: [...etat.enAttente, reponse.client_uuid] };
  await ecrireSerie(local);
  return envoyerEnAttente(local);
}

/** Question suivante ; la dernière réponse clôt la série (B11). Tente d'abord de vider la file. */
export async function avancer(etat: EtatSerie): Promise<EtatSerie> {
  const vide = await envoyerEnAttente(etat);
  const index = vide.index + 1;
  const suivant: EtatSerie = { ...vide, index, termine: index >= vide.questions.length };
  await ecrireSerie(suivant);
  return suivant;
}

/** Ajoute un mot clé au carnet (boîte 1). Le serveur est idempotent ; hors ligne, l'ajout est refusé proprement. */
export async function ajouterMotCarnet(etat: EtatSerie, mot: MotCle): Promise<EtatSerie> {
  if (etat.motsAjoutes.some((m) => m.id === mot.id)) return etat;
  await obtenirApi().ajouterMot(mot.id, maintenant());
  const suivant: EtatSerie = { ...etat, motsAjoutes: [...etat.motsAjoutes, mot] };
  await ecrireSerie(suivant);
  return suivant;
}

export const questionCourante = (etat: EtatSerie): QuestionServie | null => etat.questions[etat.index] ?? null;
export const resultatCourant = (etat: EtatSerie): ResultatReponse | null => {
  const q = questionCourante(etat);
  return q ? (etat.resultats[q.id] ?? null) : null;
};
/** La question affichée a-t-elle déjà reçu sa réponse (corrigé reçu ou réponse en file) ? */
export const questionRepondue = (etat: EtatSerie): boolean => {
  const q = questionCourante(etat);
  return !!q && etat.reponses.some((r) => r.question_id === q.id);
};

export type ResumeSerie = {
  total: number;
  repondues: number;
  bonnes: number;
  /** Questions ratées (passées comprises) : elles reviennent en rejeu (F6). */
  ratees: number;
  notions: NotionLiee[];
  mots: MotCle[];
  /** Réponses dont le corrigé n'est pas encore revenu (hors ligne). */
  enAttente: number;
  /** Délais de rejeu à annoncer (les deux premiers de `replay_delays_days`). */
  delaisRejeu: number[];
};

/** B11 : le total vient des réponses validées ; une question passée n'est pas comptée réussie (AC-B11-1). */
export function resumerSerie(etat: EtatSerie, r: Pick<Reglages, 'delaisRejeuJours'>): ResumeSerie {
  const resultats = Object.values(etat.resultats);
  const ratees = resultats.filter((x) => !x.correct);
  const notions = new Map<string, NotionLiee>();
  for (const x of resultats) if (x.notion) notions.set(x.notion.id, x.notion);
  const mots = new Map<string, MotCle>();
  for (const x of ratees) for (const m of x.words ?? []) mots.set(m.id, m);
  for (const m of etat.motsAjoutes) mots.set(m.id, m);
  return {
    total: etat.questions.length,
    repondues: resultats.filter((x) => !x.skipped).length,
    bonnes: resultats.filter((x) => x.correct).length,
    ratees: ratees.length,
    notions: [...notions.values()],
    mots: [...mots.values()],
    enAttente: etat.enAttente.length,
    delaisRejeu: r.delaisRejeuJours.slice(0, 2),
  };
}
