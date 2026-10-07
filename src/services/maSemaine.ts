import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import { estErreurReseau, signalerEchec, signalerSucces } from './connectivite';

/**
 * « Ma semaine » : mini récap de la semaine passée (lundi à dimanche). Les chiffres viennent du serveur
 * (`my_week_recap`, migration 20261007102000) ; la dernière réponse est gardée sur l'appareil pour le hors ligne.
 * Spec : `docs/maquettes/ma-semaine.md`.
 */
type Client = Pick<SupabaseClient, 'rpc'>;

export type Recap = {
  /** Lundi de la semaine (AAAA-MM-JJ). */
  semaine: string;
  missions: number;
  /** Lundi à dimanche ; null quand le serveur ne le donne pas (la grille des 7 jours est alors masquée). */
  missionsParJour: boolean[] | null;
  leconsValidees: number;
  quizTermines: number;
  exercicesFaits: number;
  questionsRatees: number;
  creditsUtilises: number;
  passActif: boolean;
  solde: number;
  rechargeLundi: number;
};

export type CarteRecap = 'missions' | 'appris' | 'ratees' | 'credits';

export const CLE_DERNIERE_SEMAINE_VUE = 'maSemaine.derniereVue';
export const CLE_COPIE_RECAP = (semaine: string) => `maSemaine.copie.${semaine}`;
/** Reprise au premier plan après cette durée : l'ouverture automatique est revérifiée (spec §5). */
export const DELAI_REPRISE_MS = 30 * 60 * 1000;
/** La ligne du centre de notifications et le récap restent consultables 8 semaines. */
export const SEMAINES_CONSERVEES = 8;

const entier = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
const FORMAT_SEMAINE = /^\d{4}-\d{2}-\d{2}$/;

/** Réponse du serveur → récap de l'app ; null si la réponse n'est pas un récap lisible. */
export function depuisReponse(brut: unknown): Recap | null {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return null;
  const r = brut as Record<string, unknown>;
  if (typeof r.semaine !== 'string' || !FORMAT_SEMAINE.test(r.semaine)) return null;
  const jours = Array.isArray(r.missions_par_jour) && r.missions_par_jour.length === 7
    ? r.missions_par_jour.map((j) => Number(j) > 0)
    : null;
  return {
    semaine: r.semaine,
    missions: entier(r.missions),
    missionsParJour: jours,
    leconsValidees: entier(r.lecons_validees),
    quizTermines: entier(r.quiz_termines),
    exercicesFaits: entier(r.exercices_faits),
    questionsRatees: entier(r.questions_ratees),
    creditsUtilises: entier(r.credits_utilises),
    passActif: r.pass_actif === true,
    solde: entier(r.solde),
    rechargeLundi: entier(r.recharge_lundi),
  };
}

// --- Dates : la semaine suit l'heure locale de l'appareil (lundi 00 h à dimanche 23 h 59) --------------------------

const deuxChiffres = (n: number) => String(n).padStart(2, '0');
const enTexte = (d: Date) => `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}`;
/** Midi local : évite tout décalage dû à l'heure d'été ou au fuseau quand on ajoute des jours. */
const depuisTexte = (s: string) => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)), 12);

/** Lundi (AAAA-MM-JJ) de la semaine qui contient la date donnée. */
export function lundiDe(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return enTexte(d);
}

export function ajouterJours(semaine: string, jours: number): string {
  const d = depuisTexte(semaine);
  d.setDate(d.getDate() + jours);
  return enTexte(d);
}

/** Lundi de la semaine précédente : celle que résume le récap. */
export const semainePrecedente = (maintenant = new Date()) => ajouterJours(lundiDe(maintenant), -7);

/** Dimanche de la semaine du lundi donné. */
export const dimancheDe = (semaine: string) => ajouterJours(semaine, 6);

/** « 28 sept. » dans la langue donnée. */
export function jourCourt(date: string, langue: string): string {
  return depuisTexte(date).toLocaleDateString(langue === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short' });
}

/** Une semaine plus vieille que 8 semaines n'est plus proposée (centre de notifications). */
export function recapExpire(semaine: string, maintenant = new Date()): boolean {
  return ajouterJours(semaine, 7 * SEMAINES_CONSERVEES) < lundiDe(maintenant);
}

// --- Règles d'affichage ----------------------------------------------------------------------------------------------

/** Le récap n'existe que s'il y a eu de l'activité ; les crédits seuls ne suffisent pas. */
export const aDeLActivite = (r: Recap) => r.missions + r.leconsValidees + r.quizTermines + r.exercicesFaits > 0;

/** Cartes affichées, dans l'ordre : une valeur principale à 0 saute la carte ; il en reste toujours au moins une. */
export function cartesDe(r: Recap): CarteRecap[] {
  const cartes: CarteRecap[] = ['missions'];
  if (r.leconsValidees + r.quizTermines + r.exercicesFaits > 0) cartes.push('appris');
  if (r.questionsRatees > 0) cartes.push('ratees');
  if (r.passActif || r.creditsUtilises > 0) cartes.push('credits');
  return cartes;
}

export type TitreMissions = 'pleine' | 'regularite' | 'debut' | 'avance';
export function titreMissions(missions: number): TitreMissions {
  if (missions >= 7) return 'pleine';
  if (missions >= 4) return 'regularite';
  if (missions >= 1) return 'debut';
  return 'avance';
}

export const joursFaits = (r: Recap) => (r.missionsParJour ?? []).filter(Boolean).length;

// --- Dernière semaine vue ---------------------------------------------------------------------------------------------

export async function derniereSemaineVue(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(CLE_DERNIERE_SEMAINE_VUE);
    return v && FORMAT_SEMAINE.test(v) ? v : null;
  } catch {
    return null;
  }
}

/** Marque la semaine comme vue (jamais en arrière : une vieille semaine rouverte ne rend pas la récente « non vue »). */
export async function marquerSemaineVue(semaine: string): Promise<void> {
  try {
    const actuelle = await derniereSemaineVue();
    if (!actuelle || semaine > actuelle) await AsyncStorage.setItem(CLE_DERNIERE_SEMAINE_VUE, semaine);
  } catch {
    // Rien de bloquant : au pire la page se rouvre une fois de plus.
  }
}

/**
 * Faut-il tenter l'ouverture automatique ? Pas pour l'invité (les chiffres viennent du compte), pas si la semaine
 * précédente a déjà été vue. L'existence d'une activité se vérifie ensuite auprès du serveur.
 */
export function doitTenterOuvertureAuto(p: { invite: boolean; derniereVue: string | null; maintenant?: Date }): boolean {
  if (p.invite) return false;
  const recap = semainePrecedente(p.maintenant);
  return !p.derniereVue || p.derniereVue < recap;
}

// --- Lecture ----------------------------------------------------------------------------------------------------------

export type ResultatRecap = { recap: Recap | null; copie: boolean };

async function lireCopie(semaine: string): Promise<Recap | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE_COPIE_RECAP(semaine));
    return brut ? depuisReponse(JSON.parse(brut)) : null;
  } catch {
    return null;
  }
}

async function garderCopie(brut: unknown, recap: Recap): Promise<void> {
  try {
    await AsyncStorage.setItem(CLE_COPIE_RECAP(recap.semaine), JSON.stringify(brut));
  } catch {
    // Copie facultative.
  }
}

/**
 * Récap de la semaine donnée (par défaut la précédente). `recap: null` : pas de récap (invité, semaine sans activité,
 * introuvable ou expirée). Sans réseau : la copie gardée sur l'appareil (`copie: true`), sinon l'erreur remonte pour
 * l'état « Pas de réseau ».
 */
export async function lireRecap(client: Client, semaine?: string | null, maintenant = new Date()): Promise<ResultatRecap> {
  const cible = semaine && FORMAT_SEMAINE.test(semaine) ? semaine : semainePrecedente(maintenant);
  try {
    const { data, error } = await client.rpc('my_week_recap', { p_semaine: cible });
    if (error) throw error;
    signalerSucces();
    const recap = depuisReponse(data);
    if (!recap || !aDeLActivite(recap)) return { recap: null, copie: false };
    await garderCopie(data, recap);
    return { recap, copie: false };
  } catch (erreur) {
    if (!estErreurReseau(erreur)) throw erreur;
    signalerEchec();
    const copie = await lireCopie(cible);
    if (copie && aDeLActivite(copie)) return { recap: copie, copie: true };
    throw erreur;
  }
}
