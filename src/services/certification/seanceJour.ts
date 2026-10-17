import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

import { suivre } from '../analytics';
import { obtenirApi } from './api';
import { ecrireJson, lireJson } from './etat';
import { lundiDe, jourPlus, type Jour } from './jours';
import type { BlocServi, SeanceServie } from './types';

/**
 * Séance du jour (D2, F7). La composition vient du serveur ; l'avancement (blocs terminés) est gardé sur l'appareil,
 * donc un bloc fini le reste après relance de l'app. La séance est enregistrée une fois, à la fin du dernier bloc,
 * avec sa composition ; un envoi manqué repart au prochain chargement (idempotent par `clientUuid`).
 */
export const CLE_SEANCE_JOUR = 'cert.seanceJour';
/** Séances terminées sur cet appareil (une entrée par séance), pour la progression de la semaine (carte Test dans). */
export const CLE_SEANCES_FAITES = 'cert.seancesFaites';

type SeanceFaite = { clientUuid: string; jour: Jour };

async function lireSeancesFaites(): Promise<SeanceFaite[]> {
  return (await lireJson<SeanceFaite[]>(CLE_SEANCES_FAITES)) ?? [];
}

/** Garde la séance finie dans le journal local ; une même séance n'est comptée qu'une fois. */
async function noterSeanceFaite(etat: EtatSeanceJour): Promise<void> {
  const liste = await lireSeancesFaites();
  if (liste.some((s) => s.clientUuid === etat.clientUuid)) return;
  await ecrireJson(CLE_SEANCES_FAITES, [...liste, { clientUuid: etat.clientUuid, jour: etat.jour }]);
}

/** Séances terminées du lundi au dimanche qui contient `jour` (journal de l'appareil). */
export async function seancesFaitesSemaine(jour: Jour): Promise<number> {
  const lundi = lundiDe(jour);
  const dimanche = jourPlus(lundi, 6);
  return (await lireSeancesFaites()).filter((s) => s.jour >= lundi && s.jour <= dimanche).length;
}
const CLE_VEILLE = 'cert.seanceJour.veille';

export type EtatSeanceJour = {
  clientUuid: string;
  exam: string;
  jour: Jour;
  seance: SeanceServie;
  /** Indices des blocs terminés dans `seance.blocs`. */
  termines: number[];
  /** Début de la séance (ms), posé au premier bloc lancé. */
  debut: number | null;
  /** Vrai quand tous les blocs sont terminés. */
  finie: boolean;
  /** Vrai quand le serveur a enregistré la séance. */
  enregistree: boolean;
};

export const lireSeanceJour = () => lireJson<EtatSeanceJour>(CLE_SEANCE_JOUR);
const ecrire = (e: EtatSeanceJour) => ecrireJson(CLE_SEANCE_JOUR, e);
export const effacerSeanceJour = () => AsyncStorage.multiRemove([CLE_SEANCE_JOUR]).catch(() => {});

const partieDeLaSerie = (s: SeanceServie): number | null => {
  const b = s.blocs.find((x): x is Extract<BlocServi, { type: 'serie' }> => x.type === 'serie');
  return b ? b.partie : null;
};

async function composer(exam: string, jour: Jour, minutes: number, clientUuid: string): Promise<EtatSeanceJour> {
  const veille = await lireJson<number>(CLE_VEILLE);
  const seance = await obtenirApi().composerSeance(exam, minutes, jour, veille);
  const etat: EtatSeanceJour = { clientUuid, exam, jour, seance, termines: [], debut: null, finie: false, enregistree: false };
  await ecrire(etat);
  return etat;
}

/**
 * La séance d'aujourd'hui : celle gardée si elle date du jour (et de la durée voulue, ou déjà commencée), sinon une
 * nouvelle composition. Un échec du serveur remonte : l'écran propose de réessayer.
 */
export async function chargerSeanceJour(exam: string, jour: Jour, minutes: number): Promise<EtatSeanceJour> {
  const gardee = await lireSeanceJour();
  if (gardee && gardee.exam === exam && gardee.jour === jour && (gardee.seance.minutes === minutes || gardee.termines.length > 0)) {
    return envoyerSeanceSiBesoin(gardee);
  }
  if (gardee && gardee.jour !== jour) {
    const p = partieDeLaSerie(gardee.seance);
    if (p !== null) await ecrireJson(CLE_VEILLE, p);
  }
  return composer(exam, jour, minutes, randomUUID());
}

/** Change la durée (AC-D2-4) : recompose une séance pas encore commencée ; une séance commencée n'est pas modifiée. */
export async function changerDuree(etat: EtatSeanceJour, minutes: number): Promise<EtatSeanceJour> {
  if (etat.termines.length > 0 || etat.seance.minutes === minutes) return etat;
  return composer(etat.exam, etat.jour, minutes, etat.clientUuid);
}

export const blocTermine = (etat: EtatSeanceJour, index: number) => etat.termines.includes(index);

/** Premier bloc pas terminé, ou `null` quand la séance est finie. */
export function indexBlocSuivant(etat: EtatSeanceJour): number | null {
  const i = etat.seance.blocs.findIndex((_, k) => !etat.termines.includes(k));
  return i === -1 ? null : i;
}

/** Index du premier bloc d'un type donné (les écrans de bloc le retrouvent à leur retour). */
export const indexDuBloc = (etat: EtatSeanceJour, type: BlocServi['type']): number => etat.seance.blocs.findIndex((b) => b.type === type);

export async function commencer(etat: EtatSeanceJour, maintenant = Date.now()): Promise<EtatSeanceJour> {
  if (etat.debut !== null) return etat;
  const suivant = { ...etat, debut: maintenant };
  await ecrire(suivant);
  return suivant;
}

/** Marque un bloc terminé ; à la fin du dernier, enregistre la séance. */
export async function terminerBloc(etat: EtatSeanceJour, index: number, maintenant = Date.now()): Promise<EtatSeanceJour> {
  if (!etat.seance.blocs[index] || etat.termines.includes(index)) return etat;
  const termines = [...etat.termines, index];
  const finie = termines.length >= etat.seance.blocs.length;
  const suivant: EtatSeanceJour = { ...etat, termines, finie, debut: etat.debut ?? maintenant };
  await ecrire(suivant);
  if (!finie) return suivant;
  await noterSeanceFaite(suivant);
  return envoyerSeanceSiBesoin(suivant, maintenant);
}

/** Enregistre la séance finie si le serveur ne l'a pas encore reçue ; garde l'état si l'envoi échoue. */
export async function envoyerSeanceSiBesoin(etat: EtatSeanceJour, maintenant = Date.now()): Promise<EtatSeanceJour> {
  if (!etat.finie || etat.enregistree) return etat;
  const minutes = etat.debut === null ? 0 : Math.min(Math.round((maintenant - etat.debut) / 60000), 240);
  try {
    await obtenirApi().terminerSeance(etat.clientUuid, etat.exam, { minutes: etat.seance.minutes, blocs: etat.seance.blocs, termines: etat.termines }, minutes, etat.jour);
    const suivant = { ...etat, enregistree: true };
    await ecrire(suivant);
    suivre('cert_session_completed', { composition: etat.seance.blocs.map((b) => b.type).join(',') });
    return suivant;
  } catch {
    return etat;
  }
}

/** « {k} sur {b} terminés » (F7). */
export const avancement = (etat: EtatSeanceJour) => ({ faits: etat.termines.length, total: etat.seance.blocs.length });

/**
 * Clôt le bloc en cours de la séance gardée sur l'appareil (série, rejeu, mots) : les blocs se font dans l'ordre, donc
 * c'est toujours le premier bloc pas terminé. Sans séance gardée, ne fait rien.
 */
export async function terminerBlocSuivant(maintenant = Date.now()): Promise<EtatSeanceJour | null> {
  const etat = await lireSeanceJour();
  if (!etat) return null;
  const i = indexBlocSuivant(etat);
  return i === null ? etat : terminerBloc(etat, i, maintenant);
}

export type ClePourquoi = 'pourquoi' | 'pourquoiUne' | 'pourquoiMots' | 'pourquoiMotsUne' | 'pourquoiMotsSeuls' | 'pourquoiMotUn' | 'pourquoiPlan';
export type Pourquoi = { cle: ClePourquoi; params: Record<string, string | number> };

/** Phrase « Parce que… » de l'accueil et de la séance (F7) : la raison la plus forte, sans jamais inventer de chiffre. */
export function pourquoiDeLaSeance(p: SeanceServie['pourquoi']): Pourquoi {
  const { erreurs, notion, motsEchus } = p;
  if (erreurs > 0 && notion) {
    const base = erreurs === 1 ? 'pourquoiUne' : 'pourquoi';
    if (motsEchus > 0) return { cle: erreurs === 1 ? 'pourquoiMotsUne' : 'pourquoiMots', params: { n: erreurs, notion, m: motsEchus } };
    return { cle: base, params: { n: erreurs, notion } };
  }
  if (motsEchus === 1) return { cle: 'pourquoiMotUn', params: {} };
  if (motsEchus > 1) return { cle: 'pourquoiMotsSeuls', params: { m: motsEchus } };
  return { cle: 'pourquoiPlan', params: {} };
}
