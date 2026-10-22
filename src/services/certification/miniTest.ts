import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

import { obtenirApi } from './api';
import { etapeDemarrage } from './erreurDemarrage';
import { ecrireJson, lireJson } from './etat';
import { jourDe } from './jours';
import type { Reglages } from './reglages';
import type { DemarrageMini, FinTentative, ReponseEnvoyee, Tentative, TypeDefTest, TypeTestFixe } from './types';

/**
 * Mini-test (T2, écran d'examen, bilan réduit). État local écrit à chaque réponse : relancer l'app ou perdre le réseau
 * ne perd rien (T3). Le chronomètre compte en horodatage absolu (`debutMs`), jamais en secondes décomptées : l'app en
 * arrière-plan ne le fige pas.
 */
export const CLE_MINI = 'cert.mini';

/** Mini-tests (10 ou 20 questions) et épreuves fixes (100 pour une moitié, 200 pour le test complet). */
export type LongueurMini = 10 | 20 | 100 | 200;

export type EtatMini = {
  /** Identifiant d'idempotence du départ : un départ rejoué ne débite pas deux fois. */
  clientUuid: string;
  exam: string;
  /** Partie choisie, `null` en mixte. */
  partie: number | null;
  longueur: LongueurMini;
  tentative: Tentative;
  /** Début du chronomètre, en millisecondes depuis 1970. */
  debutMs: number;
  /** Durée accordée en minutes, figée au départ (un réglage modifié ensuite ne change pas un test commencé). */
  dureeMin: number;
  reponses: ReponseEnvoyee[];
  index: number;
  /** Fin locale : toutes les questions vues, ou temps écoulé. Le bilan peut attendre le réseau. */
  termine: boolean;
  fin: FinTentative | null;
};

const maintenant = () => jourDe(new Date());

export const lireMini = () => lireJson<EtatMini>(CLE_MINI);
export const ecrireMini = (e: EtatMini) => ecrireJson(CLE_MINI, e);
export const effacerMini = () => AsyncStorage.removeItem(CLE_MINI).catch(() => {});

/** Une partie ou le mixte : 20 questions réservées au mixte et aux parties 5 à 7 (écart E-35). */
export const longueursPossibles = (partie: number | null): LongueurMini[] => (partie === null || partie >= 5 ? [10, 20] : [10]);

/** Le temps vient des réglages du serveur : 10 minutes pour 10 questions au départ. */
export const dureeMiniMin = (longueur: LongueurMini, r: Pick<Reglages, 'miniMinutesPour10'>) => (longueur / 10) * r.miniMinutesPour10;

/** Durée officielle des épreuves fixes (T5), en minutes : écoute 45, lecture 75, test complet 120. */
export const dureeTestMin: Record<TypeTestFixe, number> = { half_listening: 45, half_reading: 75, full: 120 };

/** Millisecondes restantes (jamais négatif). */
export const tempsRestantMs = (e: Pick<EtatMini, 'debutMs' | 'dureeMin'>, maintenantMs: number = Date.now()) =>
  Math.max(0, e.debutMs + e.dureeMin * 60_000 - maintenantMs);

/**
 * Où en est un test gardé sur l'appareil (T3) :
 * - `en_cours` : du temps reste, on reprend ;
 * - `a_rendre` : le temps est écoulé mais la tolérance de reprise court encore, le bilan se calcule avec les réponses données ;
 * - `perime` : au-delà, la tentative est abandonnée (remboursée si la fenêtre du serveur le permet).
 */
export function etatDeReprise(e: EtatMini, r: Pick<Reglages, 'repriseToleranceMin'>, maintenantMs: number = Date.now()): 'termine' | 'en_cours' | 'a_rendre' | 'perime' {
  if (e.fin) return 'termine';
  if (e.termine) return 'a_rendre';
  if (tempsRestantMs(e, maintenantMs) > 0) return 'en_cours';
  return maintenantMs <= e.debutMs + (e.dureeMin + r.repriseToleranceMin) * 60_000 ? 'a_rendre' : 'perime';
}

/** Minute écoulée depuis le départ, pour `cert_mock_abandoned`. */
export const minuteEcoulee = (e: Pick<EtatMini, 'debutMs'>, maintenantMs: number = Date.now()) => Math.max(0, Math.floor((maintenantMs - e.debutMs) / 60_000));

export type ResultatLancement = { statut: 'demarre'; etat: EtatMini } | { statut: 'insuffisant'; cout: number | null; solde: number | null } | { statut: 'compte_requis' };

/**
 * Lance un mini-test : le serveur tire les questions et débite au lancement. Un test déjà en cours n'est jamais écrasé
 * ici (l'écran T3 propose de le reprendre ou de l'abandonner d'abord).
 */
let lancementEnVol: Promise<ResultatLancement> | null = null;

export function lancerMini(exam: string, partie: number | null, longueur: LongueurMini, r: Pick<Reglages, 'miniMinutesPour10'>): Promise<ResultatLancement> {
  // Un seul lancement à la fois : un double appui ou une relance pendant l'appel ne part pas une seconde fois, avec un
  // second identifiant qui ferait échouer le premier (409 côté serveur, « n'a pas démarré » à l'écran).
  if (lancementEnVol) return lancementEnVol;
  lancementEnVol = lancerMiniUnique(exam, partie, longueur, r).finally(() => {
    lancementEnVol = null;
  });
  return lancementEnVol;
}

async function lancerMiniUnique(exam: string, partie: number | null, longueur: LongueurMini, r: Pick<Reglages, 'miniMinutesPour10'>): Promise<ResultatLancement> {
  const clientUuid = randomUUID();
  const rep: DemarrageMini = await etapeDemarrage('appel', () => obtenirApi().demarrerMini(clientUuid, exam, partie, longueur, maintenant()));
  if (rep.status === 'account_required') return { statut: 'compte_requis' };
  if (rep.status === 'insufficient' || !rep.tentative) return { statut: 'insuffisant', cout: rep.cout, solde: rep.solde };
  const debut = rep.status === 'replay' ? Date.parse(rep.tentative.started_at) : Date.now();
  const etat: EtatMini = {
    clientUuid, exam, partie, longueur, tentative: rep.tentative,
    debutMs: Number.isFinite(debut) ? debut : Date.now(),
    dureeMin: dureeMiniMin(longueur, r),
    reponses: [], index: 0, termine: false, fin: null,
  };
  await etapeDemarrage('stockage', () => ecrireMini(etat));
  return { statut: 'demarre', etat };
}

/**
 * Lance un demi-test ou le test complet (T5) : même état local et même reprise que le mini-test, avec la durée officielle.
 * Le serveur tire les questions du test fixe et débite au lancement.
 */
export async function lancerTest(exam: string, testId: string, type: TypeTestFixe): Promise<ResultatLancement> {
  const clientUuid = randomUUID();
  const rep: DemarrageMini = await etapeDemarrage('appel', () => obtenirApi().demarrerTest(clientUuid, testId, type, exam, maintenant()));
  if (rep.status === 'account_required') return { statut: 'compte_requis' };
  if (rep.status === 'insufficient' || !rep.tentative) return { statut: 'insuffisant', cout: rep.cout, solde: rep.solde };
  const debut = rep.status === 'replay' ? Date.parse(rep.tentative.started_at) : Date.now();
  const etat: EtatMini = {
    clientUuid, exam, partie: null, longueur: rep.tentative.questions.length as LongueurMini, tentative: rep.tentative,
    debutMs: Number.isFinite(debut) ? debut : Date.now(),
    dureeMin: dureeTestMin[type],
    reponses: [], index: 0, termine: false, fin: null,
  };
  await etapeDemarrage('stockage', () => ecrireMini(etat));
  return { statut: 'demarre', etat };
}

/** Enregistre la réponse sur l'appareil puis avance. `chosen: null` = question passée, comptée fausse. Pas de correction. */
export async function repondreMini(etat: EtatMini, chosen: number | null, ms: number): Promise<EtatMini> {
  if (etat.termine || etat.fin) return etat;
  const question = etat.tentative.questions[etat.index];
  if (!question) return etat;
  if (etat.reponses.some((x) => x.question_id === question.id)) return etat;
  const reponse: ReponseEnvoyee = {
    question_id: question.id, client_uuid: randomUUID(), chosen, ms: Math.max(0, Math.round(ms)),
    context: 'test', local_day: maintenant(), attempt_id: etat.tentative.attempt_id,
  };
  const index = etat.index + 1;
  const suivant: EtatMini = { ...etat, reponses: [...etat.reponses, reponse], index, termine: index >= etat.tentative.questions.length };
  await ecrireMini(suivant);
  return suivant;
}

/** Temps écoulé : on garde les réponses données, les autres ne sont pas envoyées. */
export async function cloreParTemps(etat: EtatMini): Promise<EtatMini> {
  if (etat.termine || etat.fin) return etat;
  const suivant = { ...etat, termine: true };
  await ecrireMini(suivant);
  return suivant;
}

/** Envoie les réponses et calcule le bilan. Idempotent : rejouable après un échec réseau. */
export async function terminerMini(etat: EtatMini): Promise<EtatMini> {
  if (etat.fin) return etat;
  const fin = await obtenirApi().terminerTentative(etat.tentative.attempt_id, etat.reponses);
  const suivant = { ...etat, termine: true, fin };
  await ecrireMini(suivant);
  return suivant;
}

/** Abandon voulu (T3) ou test périmé : le serveur rembourse dans sa fenêtre, l'état local est effacé. */
export async function abandonnerMini(etat: EtatMini, raison: 'user' | 'expired'): Promise<{ rembourse: boolean }> {
  const rep = await obtenirApi().abandonnerTentative(etat.tentative.attempt_id, raison);
  await effacerMini();
  return { rembourse: rep.rembourse };
}

/** Type de test composé (liste v38, v39) vers le type d'épreuve qui fixe la durée et le débit. */
const typeDeDefinition: Record<TypeDefTest, TypeTestFixe> = { listening: 'half_listening', reading: 'half_reading', full: 'full' };

/**
 * Lance un test composé (listes v38, v39) : même contrat que `lancerTest` (débit au lancement, replay), tiré du test
 * composé choisi dans la liste.
 */
export async function lancerDefTest(exam: string, defId: string, kind: TypeDefTest): Promise<ResultatLancement> {
  const clientUuid = randomUUID();
  const rep: DemarrageMini = await etapeDemarrage('appel', () => obtenirApi().demarrerDefTest(clientUuid, defId, exam, maintenant()));
  if (rep.status === 'account_required') return { statut: 'compte_requis' };
  if (rep.status === 'insufficient' || !rep.tentative) return { statut: 'insuffisant', cout: rep.cout, solde: rep.solde };
  const type = typeDeDefinition[kind];
  const debut = rep.status === 'replay' ? Date.parse(rep.tentative.started_at) : Date.now();
  const etat: EtatMini = {
    clientUuid, exam, partie: null, longueur: rep.tentative.questions.length as LongueurMini, tentative: rep.tentative,
    debutMs: Number.isFinite(debut) ? debut : Date.now(),
    dureeMin: dureeTestMin[type],
    reponses: [], index: 0, termine: false, fin: null,
  };
  await etapeDemarrage('stockage', () => ecrireMini(etat));
  return { statut: 'demarre', etat };
}
