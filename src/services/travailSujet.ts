import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { fetch as fetchFlux } from 'expo/fetch';
import { useSyncExternalStore } from 'react';

import { cadrePixels, preparerImage, type Cadre } from './photo';

/**
 * Anciens sujets corrigés par l'IA (#72) : l'élève photographie son travail, remet les feuilles dans l'ordre où il les a
 * résolues, la fonction serveur exam-correction corrige question par question (points) et range les feuilles dans le
 * stockage privé. Les crédits (action `ai_question`) sont débités et rendus par le serveur ; l'app n'a aucun montant.
 */

export type TypeSujet = 'exam' | 'document';
export type Feuille = { id: string; uri: string; largeur: number; hauteur: number };
export type QuestionNotee = { n: string; titre: string; points: number; max: number; commentaire: string };
export type ResultatTravail = { questions: QuestionNotee[]; resume: string; barème_propose?: boolean };
export type StatutSession = 'pending' | 'done' | 'unreadable' | 'failed';
export type Session = {
  id: string;
  statut: StatutSession;
  /** Points obtenus et total du barème (null tant que la correction n'est pas finie). */
  score: number | null;
  total: number | null;
  feuilles: number;
  /** Temps passé sur le sujet, en secondes, si l'élève l'a chronométré. */
  tempsS: number | null;
  date: string;
  resultat: ResultatTravail | null;
  feuillesEffacees: boolean;
};

export const MAX_FEUILLES = 12;

export type EtapeTravail = 'envoi' | 'correction' | 'notation';
export const ETAPES_TRAVAIL: EtapeTravail[] = ['envoi', 'correction', 'notation'];

export type Evenement =
  | { t: 'etape'; etape: EtapeTravail }
  | { t: 'fin'; id: string; score: number; total: number; resultat: ResultatTravail }
  | { t: 'illisible'; id: string; raison: string }
  | { t: 'erreur'; code: string };

export type Issue =
  | { type: 'fin'; id: string; score: number; total: number; resultat: ResultatTravail }
  | { type: 'illisible'; raison: string }
  | { type: 'credits' }
  | { type: 'quota' }
  | { type: 'limite'; minutes: number | null }
  | { type: 'hors-ligne' }
  | { type: 'erreur' };

// --- Feuilles : ajout, ordre, retrait (fonctions pures, testées) ---------------------------------------------------------

let compteur = 0;
export const nouvelleFeuille = (p: { uri: string; largeur: number; hauteur: number }): Feuille => ({ id: `f${Date.now().toString(36)}${(compteur++).toString(36)}`, ...p });

/** Ajoute des feuilles à la suite sans dépasser le maximum ; renvoie aussi le nombre de feuilles refusées. */
export function ajouterFeuilles(liste: readonly Feuille[], nouvelles: readonly Feuille[]): { liste: Feuille[]; refusees: number } {
  const place = Math.max(0, MAX_FEUILLES - liste.length);
  return { liste: [...liste, ...nouvelles.slice(0, place)], refusees: Math.max(0, nouvelles.length - place) };
}

/** Déplace la feuille `de` vers la position `vers` (bornée). Renvoie la même liste si rien ne change. */
export function deplacerFeuille(liste: readonly Feuille[], de: number, vers: number): Feuille[] {
  const cible = Math.max(0, Math.min(liste.length - 1, vers));
  if (de < 0 || de >= liste.length || cible === de) return [...liste];
  const copie = [...liste];
  const [f] = copie.splice(de, 1);
  copie.splice(cible, 0, f);
  return copie;
}

export const retirerFeuille = (liste: readonly Feuille[], index: number): Feuille[] => liste.filter((_, i) => i !== index);

// --- Note ----------------------------------------------------------------------------------------------------------------

const nombre = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
/** « 14/20 », « 7,5/12 » : points obtenus sur le total du barème. */
export const libelleNote = (score: number, total: number) => `${nombre(score)}/${nombre(total)}`;
export const libellePoints = (points: number, max: number) => `${nombre(points)}/${nombre(max)}`;

export type NiveauPoints = 'plein' | 'partiel' | 'nul';
/** Couleur de la pastille de points : tout (vert), une partie (jaune), rien (corail). Jamais la couleur seule : les points sont écrits. */
export function niveauPoints(points: number, max: number): NiveauPoints {
  if (points <= 0) return 'nul';
  return points >= max ? 'plein' : 'partiel';
}

/** Note globale : bonne à partir de 60 %, à travailler en dessous de 40 %. */
export function niveauNote(score: number, total: number): 'bonne' | 'moyenne' | 'faible' {
  const r = total > 0 ? score / total : 0;
  return r >= 0.6 ? 'bonne' : r >= 0.4 ? 'moyenne' : 'faible';
}

/** « 1 h 52 » ou « 45 min ». */
export function dureeLisible(secondes: number): string {
  const min = Math.max(1, Math.round(secondes / 60));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

// --- Brouillon en cours (feuilles prises, pas encore envoyées) -----------------------------------------------------------

export type Brouillon = { kind: TypeSujet; ref: string; titre: string; matiere: string | null; tempsS: number | null; feuilles: Feuille[] };

let brouillon: Brouillon | null = null;
const ecouteurs = new Set<() => void>();
const emettre = () => ecouteurs.forEach((f) => f());

export const lireBrouillon = () => brouillon;
export function definirBrouillon(b: Brouillon | null) {
  brouillon = b;
  emettre();
}
export function majFeuilles(modifier: (f: Feuille[]) => Feuille[]) {
  if (brouillon) definirBrouillon({ ...brouillon, feuilles: modifier(brouillon.feuilles) });
}
/** Le brouillon vit en mémoire : les photos sont dans le cache de l'appareil, on ne garde pas de copie sur disque. */
export const useBrouillon = () => useSyncExternalStore((f) => { ecouteurs.add(f); return () => { ecouteurs.delete(f); }; }, lireBrouillon, lireBrouillon);

// --- Envoi et lecture ----------------------------------------------------------------------------------------------------

/**
 * Qualité d'une feuille envoyée : plus fine qu'une photo d'aide (1280 px, 0,7), car une écriture manuscrite petite ou une
 * photo un peu sombre doit rester lisible pour l'IA. ~500 Ko par feuille, 12 feuilles au plus sous la limite du serveur.
 */
export const QUALITE_FEUILLE = { coteMax: 1800, compress: 0.8 };

/** Feuille cadrée en entier, réduite et compressée en JPEG de bonne qualité. */
export async function preparerFeuille(f: Feuille): Promise<string> {
  const { base64 } = await preparerImage(f.uri, { x: 0, y: 0, largeur: 1, hauteur: 1 }, f.largeur, f.hauteur, QUALITE_FEUILLE);
  return base64;
}

/** Remplace une feuille (même identifiant, même place) après un recadrage ou une rotation. */
export const remplacerFeuille = (liste: readonly Feuille[], id: string, nouvelle: Pick<Feuille, 'uri' | 'largeur' | 'hauteur'>): Feuille[] =>
  liste.map((f) => (f.id === id ? { ...f, ...nouvelle } : f));

/** Pivote la feuille d'un quart de tour à droite ; la largeur et la hauteur s'échangent. */
export async function pivoterFeuille(f: Feuille): Promise<Pick<Feuille, 'uri' | 'largeur' | 'hauteur'>> {
  const image = await ImageManipulator.manipulate(f.uri).rotate(90).renderAsync();
  const r = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
  return { uri: r.uri, largeur: f.hauteur, hauteur: f.largeur };
}

/** Recadre la feuille sur un cadre en fractions (0–1) de l'image. */
export async function recadrerFeuille(f: Feuille, cadre: Cadre): Promise<Pick<Feuille, 'uri' | 'largeur' | 'hauteur'>> {
  const c = cadrePixels(cadre, f.largeur, f.hauteur);
  const image = await ImageManipulator.manipulate(f.uri).crop({ originX: c.x, originY: c.y, width: c.largeur, height: c.hauteur }).renderAsync();
  const r = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
  return { uri: r.uri, largeur: c.largeur, hauteur: c.hauteur };
}

export function lireLignes(tampon: string): { evenements: Evenement[]; reste: string } {
  const lignes = tampon.split('\n');
  const reste = lignes.pop() ?? '';
  const evenements: Evenement[] = [];
  for (const l of lignes) {
    if (!l.trim()) continue;
    try {
      const e = JSON.parse(l) as Evenement;
      if (e && typeof e === 'object' && 't' in e) evenements.push(e);
    } catch {
      // ligne illisible : ignorée
    }
  }
  return { evenements, reste };
}

export function issueDe(e: Evenement): Issue | null {
  if (e.t === 'fin') return { type: 'fin', id: e.id, score: e.score, total: e.total, resultat: e.resultat };
  if (e.t === 'illisible') return { type: 'illisible', raison: e.raison };
  if (e.t === 'erreur') return { type: 'erreur' };
  return null;
}

/** Étapes déjà atteintes : l'envoi est fait quand la correction démarre, la notation quand l'IA a répondu. */
export type EtatEtapeTravail = 'attente' | 'en_cours' | 'fait' | 'echec';
export function etatsEtapesTravail(recues: readonly EtapeTravail[], echec = false): EtatEtapeTravail[] {
  // Avant le premier signal du serveur, la préparation et l'envoi des feuilles sont déjà la première étape en cours.
  const atteinte = Math.max(0, ETAPES_TRAVAIL.reduce((n, p, i) => (recues.includes(p) ? i : n), -1));
  return ETAPES_TRAVAIL.map((_, i) => (i < atteinte ? 'fait' : i === atteinte ? (echec ? 'echec' : 'en_cours') : 'attente'));
}

type Options = { kind: TypeSujet; ref: string; pages: string[]; titre: string; matiere: string | null; tempsS: number | null; surEtape: (e: EtapeTravail) => void; signal?: AbortSignal };

/**
 * Envoie les feuilles et suit le flux. Sans réseau : « hors-ligne » ; solde insuffisant : « credits » ; limite du jour du
 * pass : « quota » ; limite de cadence : « limite ». La correction continue côté serveur si l'élève quitte l'écran.
 */
export async function envoyerTravail(client: SupabaseClient, { kind, ref, pages, titre, matiere, tempsS, surEtape, signal }: Options): Promise<Issue> {
  const { data } = await client.auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) return { type: 'erreur' };
  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/exam-correction`;
  let reponse: Awaited<ReturnType<typeof fetchFlux>>;
  try {
    reponse = await fetchFlux(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jeton}`, apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, ref, pages, titre, matiere, time_spent_s: tempsS }),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    return { type: 'hors-ligne' };
  }
  if (reponse.status === 402) return { type: 'credits' };
  if (reponse.status === 429) {
    const corps = (await reponse.json().catch(() => ({}))) as { code?: string; reessayez_dans_minutes?: number };
    if (corps.code === 'limite') return { type: 'limite', minutes: corps.reessayez_dans_minutes ?? null };
    return { type: 'quota' };
  }
  if (!reponse.ok) return { type: 'erreur' };
  const id = reponse.headers.get('X-Session-Id');

  let tampon = '';
  let issue: Issue | null = null;
  const traiter = (texte: string) => {
    const { evenements, reste } = lireLignes(texte);
    tampon = reste;
    for (const e of evenements) {
      if (e.t === 'etape') surEtape(e.etape);
      issue = issueDe(e) ?? issue;
    }
  };
  try {
    const lecteur = reponse.body?.getReader();
    if (lecteur) {
      const decodeur = new TextDecoder();
      for (;;) {
        const { value, done } = await lecteur.read();
        if (done) break;
        traiter(tampon + decodeur.decode(value, { stream: true }));
      }
    } else {
      traiter((await reponse.text()) + '\n');
    }
    if (tampon.trim()) traiter(tampon + '\n');
  } catch (e) {
    if (signal?.aborted) throw e;
    // Coupure en cours de route : la correction continue côté serveur, on la relit.
    if (id) return (await reprendreSession(client, id)) ?? { type: 'hors-ligne' };
    return { type: 'hors-ligne' };
  }
  return issue ?? { type: 'erreur' };
}

type Ligne = {
  id: string;
  status: StatutSession;
  score: number | null;
  max_score: number | null;
  page_count: number;
  time_spent_s: number | null;
  created_at: string;
  result: (ResultatTravail & { raison?: string }) | null;
  images_purged_at: string | null;
};
const COLONNES = 'id,status,score,max_score,page_count,time_spent_s,created_at,result,images_purged_at';

export function sessionDepuis(l: Ligne): Session {
  return {
    id: l.id,
    statut: l.status,
    score: l.score === null ? null : Number(l.score),
    total: l.max_score === null ? null : Number(l.max_score),
    feuilles: l.page_count,
    tempsS: l.time_spent_s,
    date: l.created_at,
    resultat: l.status === 'done' ? l.result : null,
    feuillesEffacees: !!l.images_purged_at,
  };
}

/** Sessions terminées de l'élève sur ce sujet, de la plus récente à la plus ancienne. */
export async function lireSessions(client: Pick<SupabaseClient, 'from'>, kind: TypeSujet, ref: string): Promise<Session[]> {
  const { data, error } = await client.from('exam_attempts').select(COLONNES).eq('paper_kind', kind).eq('paper_ref', ref).eq('status', 'done').order('created_at', { ascending: false }).limit(20);
  if (error) throw error;
  return ((data ?? []) as Ligne[]).map(sessionDepuis);
}

export async function lireSession(client: Pick<SupabaseClient, 'from'>, id: string): Promise<Session | null> {
  const { data, error } = await client.from('exam_attempts').select(COLONNES).eq('id', id).maybeSingle<Ligne>();
  if (error) throw error;
  return data ? sessionDepuis(data) : null;
}

/** Relit une session enregistrée (après une coupure). `null` tant qu'elle n'est pas finie. */
export async function reprendreSession(client: Pick<SupabaseClient, 'from'>, id: string): Promise<Issue | null> {
  const s = await lireSession(client, id).catch(() => null);
  if (!s) return null;
  return s.statut === 'done' && s.resultat && s.score !== null && s.total !== null
    ? { type: 'fin', id: s.id, score: s.score, total: s.total, resultat: s.resultat }
    : s.statut === 'unreadable' ? { type: 'illisible', raison: '' }
    : s.statut === 'failed' ? { type: 'erreur' }
    : null;
}

/** Adresses signées des feuilles d'une session, dans l'ordre. Vide si les feuilles sont effacées (30 jours) ou hors ligne. */
export async function lireUrlsFeuilles(client: SupabaseClient, id: string): Promise<string[]> {
  const { data, error } = await client.functions.invoke<{ urls?: string[] }>('exam-correction', { body: { action: 'urls', id } });
  if (error) throw error;
  return data?.urls ?? [];
}

// --- Temps de travail choisi avant d'ouvrir le sujet --------------------------------------------------------------------

/** « Mesurer mon temps » (chrono montant) ou « Compte à rebours » (simulation d'examen). */
export type ModeTemps = 'libre' | 'compte';
/** Compte à rebours : temps conseillé du sujet ou temps saisi par l'élève. */
export type ChoixCompte = 'conseille' | 'perso';
export type PreferenceTemps = { mode: ModeTemps; choix: ChoixCompte; minutes: string };

export const PREFERENCE_TEMPS_DEFAUT: PreferenceTemps = { mode: 'compte', choix: 'conseille', minutes: '' };
export const MINUTES_MIN = 1;
export const MINUTES_MAX = 600;
const CLE_TEMPS = 'annales.temps.preference';

/** Minutes saisies → nombre entier valide (1 à 600), sinon null. */
export function minutesValides(texte: string): number | null {
  if (!/^\d{1,3}$/.test(texte.trim())) return null;
  const n = Number(texte.trim());
  return n >= MINUTES_MIN && n <= MINUTES_MAX ? n : null;
}

/**
 * Valeur transmise au lecteur : 'libre' (chrono montant), un nombre de secondes (compte à rebours) ou null quand le
 * choix est incomplet (temps conseillé inconnu, temps saisi invalide) : le bouton « Ouvrir le sujet » reste alors éteint.
 */
export function dureeDemarrage(pref: PreferenceTemps, dureeConseilleeMin: number | null): string | null {
  if (pref.mode === 'libre') return 'libre';
  const minutes = pref.choix === 'conseille' && dureeConseilleeMin ? dureeConseilleeMin : pref.choix === 'perso' ? minutesValides(pref.minutes) : null;
  return minutes ? String(minutes * 60) : null;
}

/**
 * Choix mémorisé ; sans durée conseillée, le compte à rebours retombe sur « Mon temps » si l'élève a déjà saisi un temps,
 * sinon sur le chrono libre : la feuille s'ouvre alors avec un choix valide et « Commencer » reste à un appui.
 */
export function preferenceCoherente(pref: PreferenceTemps, dureeConseilleeMin: number | null): PreferenceTemps {
  if (pref.mode !== 'compte' || pref.choix !== 'conseille' || dureeConseilleeMin) return pref;
  return minutesValides(pref.minutes) ? { ...pref, choix: 'perso' } : { ...pref, mode: 'libre' };
}

export async function lirePreferenceTemps(): Promise<PreferenceTemps> {
  try {
    const brut = await AsyncStorage.getItem(CLE_TEMPS);
    const p = brut ? (JSON.parse(brut) as Partial<PreferenceTemps>) : {};
    return {
      mode: p.mode === 'libre' ? 'libre' : 'compte',
      choix: p.choix === 'perso' ? 'perso' : 'conseille',
      minutes: typeof p.minutes === 'string' && minutesValides(p.minutes) ? p.minutes : '',
    };
  } catch {
    return PREFERENCE_TEMPS_DEFAUT;
  }
}
export const enregistrerPreferenceTemps = (p: PreferenceTemps) => AsyncStorage.setItem(CLE_TEMPS, JSON.stringify(p)).catch(() => {});
