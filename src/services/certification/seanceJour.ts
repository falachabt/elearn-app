import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

import { obtenirApi } from './api';
import { ecrireJson, lireJson } from './etat';
import type { Jour } from './jours';
import type { BlocServi, SeanceServie } from './types';

/**
 * Séance du jour (D2, F7). La composition vient du serveur ; l'avancement (blocs terminés) est gardé sur l'appareil,
 * donc un bloc fini le reste après relance de l'app. La séance est enregistrée une fois, à la fin du dernier bloc,
 * avec sa composition ; un envoi manqué repart au prochain chargement (idempotent par `clientUuid`).
 */
export const CLE_SEANCE_JOUR = 'cert.seanceJour';
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
  return finie ? envoyerSeanceSiBesoin(suivant, maintenant) : suivant;
}

/** Enregistre la séance finie si le serveur ne l'a pas encore reçue ; garde l'état si l'envoi échoue. */
export async function envoyerSeanceSiBesoin(etat: EtatSeanceJour, maintenant = Date.now()): Promise<EtatSeanceJour> {
  if (!etat.finie || etat.enregistree) return etat;
  const minutes = etat.debut === null ? 0 : Math.min(Math.round((maintenant - etat.debut) / 60000), 240);
  try {
    await obtenirApi().terminerSeance(etat.clientUuid, etat.exam, { minutes: etat.seance.minutes, blocs: etat.seance.blocs, termines: etat.termines }, minutes, etat.jour);
    const suivant = { ...etat, enregistree: true };
    await ecrire(suivant);
    return suivant;
  } catch {
    return etat;
  }
}

/** « {k} sur {b} terminés » (F7). */
export const avancement = (etat: EtatSeanceJour) => ({ faits: etat.termines.length, total: etat.seance.blocs.length });
