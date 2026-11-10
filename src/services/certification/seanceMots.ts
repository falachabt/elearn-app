import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

import { obtenirApi } from './api';
import { appliquerResultatMot, composerSeanceMots, type MotCarnet } from './certCarnet';
import { ecrireJson, lireJson } from './etat';
import { jourDe, type Jour } from './jours';
import type { Reglages } from './reglages';
import type { MotCarnetServi, ResultatMot } from './types';

/**
 * Séance de mots (C8, C9) : rappel espacé en boîtes (F5). Chaque note est écrite sur l'appareil avant d'être envoyée ;
 * un envoi manqué reste en file et repart tel quel (idempotent par `clientUuid`). Un mot n'est noté qu'après retournement.
 */
export const CLE_SEANCE_MOTS = 'cert.seanceMots';

export type EtatSeanceMots = {
  clientUuid: string;
  exam: string;
  jour: Jour;
  /** `seance` : lancée depuis la séance du jour (C9 ramène à D2) ; `carnet` : depuis le carnet. */
  origine: 'seance' | 'carnet';
  cartes: MotCarnetServi[];
  index: number;
  retourne: boolean;
  resultats: ResultatMot[];
  enAttente: ResultatMot[];
  termine: boolean;
};

export const lireSeanceMots = () => lireJson<EtatSeanceMots>(CLE_SEANCE_MOTS);
const ecrire = (e: EtatSeanceMots) => ecrireJson(CLE_SEANCE_MOTS, e);
export const effacerSeanceMots = () => AsyncStorage.removeItem(CLE_SEANCE_MOTS).catch(() => {});

const versCarnet = (m: MotCarnetServi): MotCarnet => ({ motId: m.id, boite: m.boite, prochaineRevue: m.prochaineRevue, vus: m.vus, bons: m.bons, mauvais: m.mauvais });

/** Choisit les mots échus (boîte croissante, échéance la plus ancienne) ; `null` quand il n'y en a aucun (séance non proposée). */
export function choisirCartes(mots: MotCarnetServi[], jour: Jour, taille: number): MotCarnetServi[] {
  const ids = composerSeanceMots(mots.map(versCarnet), jour, taille).map((m) => m.motId);
  return ids.map((id) => mots.find((m) => m.id === id)!).filter(Boolean);
}

export async function demarrerSeanceMots(exam: string, mots: MotCarnetServi[], options: { taille: number; origine: 'seance' | 'carnet'; nombre?: number }, jour: Jour = jourDe(new Date())): Promise<EtatSeanceMots | null> {
  const cartes = choisirCartes(mots, jour, Math.min(options.taille, options.nombre ?? options.taille));
  if (cartes.length === 0) return null;
  const etat: EtatSeanceMots = { clientUuid: randomUUID(), exam, jour, origine: options.origine, cartes, index: 0, retourne: false, resultats: [], enAttente: [], termine: false };
  await ecrire(etat);
  return etat;
}

/** Reprend la séance en cours (même origine), sinon `null` : l'appelant en démarre une. */
export async function reprendreSeanceMots(exam: string, origine: 'seance' | 'carnet'): Promise<EtatSeanceMots | null> {
  const e = await lireSeanceMots();
  return e && !e.termine && e.exam === exam && e.origine === origine ? e : null;
}

export async function retournerCarte(etat: EtatSeanceMots): Promise<EtatSeanceMots> {
  if (etat.retourne || etat.termine) return etat;
  const suivant = { ...etat, retourne: true };
  await ecrire(suivant);
  return suivant;
}

/** Envoie les notes en file ; celles que le serveur n'a pas reçues y restent. */
export async function envoyerNotesEnAttente(etat: EtatSeanceMots): Promise<EtatSeanceMots> {
  if (etat.enAttente.length === 0) return etat;
  try {
    await obtenirApi().envoyerResultatsMots(etat.enAttente);
    const suivant = { ...etat, enAttente: [] };
    await ecrire(suivant);
    return suivant;
  } catch {
    return etat;
  }
}

/** Note la carte (après retournement seulement), passe à la suivante et clôt la séance après la dernière. */
export async function noterCarte(etat: EtatSeanceMots, connu: boolean): Promise<EtatSeanceMots> {
  const carte = etat.cartes[etat.index];
  if (!carte || !etat.retourne || etat.termine) return etat;
  const note: ResultatMot = { wordId: carte.id, clientUuid: randomUUID(), connu, jour: etat.jour };
  const index = etat.index + 1;
  const local: EtatSeanceMots = { ...etat, resultats: [...etat.resultats, note], enAttente: [...etat.enAttente, note], index, retourne: false, termine: index >= etat.cartes.length };
  await ecrire(local);
  return envoyerNotesEnAttente(local);
}

export type ResumeSeanceMots = {
  total: number;
  sus: number;
  /** Mots notés « Je ne savais pas » : boîte 1, retour demain (échéance J + premier délai). */
  aRevoir: number;
  /** Tous les mots de la séance par boîte après la séance (la somme égale `total`). */
  boites: Record<1 | 2 | 3 | 4, number>;
  /** Délai du premier niveau, pour le texte d'aide. */
  delaiAvant: number;
};

export function resumerSeanceMots(etat: EtatSeanceMots, r: Pick<Reglages, 'delaisBoitesJours'>): ResumeSeanceMots {
  const boites: ResumeSeanceMots['boites'] = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let sus = 0;
  for (const carte of etat.cartes) {
    const note = etat.resultats.find((x) => x.wordId === carte.id);
    const apres = note ? appliquerResultatMot(versCarnet(carte), note.connu, etat.jour, r) : versCarnet(carte);
    boites[apres.boite]++;
    if (note?.connu) sus++;
  }
  return { total: etat.cartes.length, sus, aRevoir: etat.resultats.filter((x) => !x.connu).length, boites, delaiAvant: r.delaisBoitesJours[0] };
}

export const carteCourante = (etat: EtatSeanceMots): MotCarnetServi | null => etat.cartes[etat.index] ?? null;
