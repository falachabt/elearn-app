import AsyncStorage from '@react-native-async-storage/async-storage';

import type { EtatHorsLigne } from './horsLigne';

/**
 * Proposition proactive du téléchargement hors ligne (issue #118).
 *
 * À certains moments (arrivée hors ligne sans contenu, mission du jour faite…), l'accueil propose
 * à l'élève de télécharger son programme pour travailler sans connexion. Cette proposition ne
 * doit jamais devenir un harcèlement : au plus une fois par jour, trois fois en tout, et
 * seulement pour un compte créé avec un profil terminé dont le pack n'est ni téléchargé ni en
 * cours de téléchargement. La cadence suit le patron des rappels (`rappels.ts`).
 */
export const CLE_PROPOSITION_HORS_LIGNE = 'rappel.propositionHorsLigne';
export const MAX_PROPOSITIONS_HORS_LIGNE = 3;
/** Délai minimal entre deux affichages : « Plus tard » reporte donc au lendemain. */
export const DELAI_PROPOSITION_JOURS = 1;

const JOUR_MS = 24 * 60 * 60 * 1000;

type EtatProposition = { vus: number; le: string };

export type VarianteProposition = 'absent' | 'partiel';

const joursDepuis = (iso: string, maintenant: Date) => (maintenant.getTime() - new Date(iso).getTime()) / JOUR_MS;

/** Variante à proposer selon l'état du pack : rien (ou simple estimation) → « absent », reprise → « partiel », sinon aucune. */
export function variantePourStatut(statut: EtatHorsLigne['statut'] | null): VarianteProposition | null {
  if (statut === null || statut === 'pret') return 'absent';
  if (statut === 'partiel') return 'partiel';
  return null; // 'telechargement' ou 'termine' : rien à proposer
}

/**
 * Éligibilité hors cadence : compte créé (pas un invité), profil terminé, pack à télécharger
 * et un contexte qui le justifie (déclencheur : hors ligne à l'arrivée, mission faite…).
 */
export function propositionEligible(p: {
  invite: boolean;
  profilTermine: boolean;
  statutPack: EtatHorsLigne['statut'] | null;
  declencheur: boolean;
}): boolean {
  if (p.invite || !p.profilTermine || !p.declencheur) return false;
  return variantePourStatut(p.statutPack) !== null;
}

/** Cadence : jamais plus de MAX_PROPOSITIONS_HORS_LIGNE affichages, espacés d'au moins un jour. */
export function propositionDue(etat: EtatProposition | null, maintenant = new Date()): boolean {
  if (!etat) return true;
  return etat.vus < MAX_PROPOSITIONS_HORS_LIGNE && joursDepuis(etat.le, maintenant) >= DELAI_PROPOSITION_JOURS;
}

async function lireEtat(): Promise<EtatProposition | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE_PROPOSITION_HORS_LIGNE);
    return brut ? (JSON.parse(brut) as EtatProposition) : null;
  } catch {
    return null;
  }
}

/** Faut-il afficher la proposition maintenant ? Éligibilité + cadence. */
export async function doitProposerHorsLigne(
  p: { invite: boolean; profilTermine: boolean; statutPack: EtatHorsLigne['statut'] | null; declencheur: boolean },
  maintenant = new Date(),
): Promise<boolean> {
  if (!propositionEligible(p)) return false;
  return propositionDue(await lireEtat(), maintenant);
}

/** Note un affichage (consomme la cadence, quel que soit le choix de l'élève ensuite). */
export async function noterPropositionHorsLigne(maintenant = new Date()): Promise<void> {
  const etat = await lireEtat();
  await AsyncStorage.setItem(
    CLE_PROPOSITION_HORS_LIGNE,
    JSON.stringify({ vus: (etat?.vus ?? 0) + 1, le: maintenant.toISOString() } satisfies EtatProposition),
  );
}
