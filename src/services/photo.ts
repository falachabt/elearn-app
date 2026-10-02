import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetch as fetchFlux } from 'expo/fetch';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { Bloc, Segment } from './blocs';
import { identifiantAppareil, lireCouts, lireSolde } from './credits';
import { latexVersTexte, texteAvecFormules } from './blocs';

/**
 * Aide par photo (M3) : préparation de l'image recadrée, envoi à la fonction serveur photo-correction (flux NDJSON),
 * avis, signalement, compteur de crédits. Aucune clé d'IA dans l'app : tout passe par la fonction Edge.
 */

export const MATIERES_PHOTO = ['maths', 'physique', 'chimie', 'svt', 'francais', 'anglais'] as const;
export type MatierePhoto = (typeof MATIERES_PHOTO)[number];

export type EtapeCorrection = { titre: string; detail: string };
export type CorrectionPhoto = {
  matiere: string;
  enonce: string;
  methode: string;
  etapes: EtapeCorrection[];
  resultat: string;
  a_retenir: string;
  notion: string;
};

/** Étapes de l'écran d'analyse (B3), dans l'ordre. */
export type Progression = 'enonce' | 'methode' | 'redaction';
export const PROGRESSIONS: Progression[] = ['enonce', 'methode', 'redaction'];

export type Evenement =
  | { t: 'etape'; etape: Progression }
  | { t: 'fin'; id: string; correction: CorrectionPhoto }
  | { t: 'illisible'; id: string; raison: string }
  | { t: 'erreur'; code: string };

export type Issue =
  | { type: 'fin'; id: string; correction: CorrectionPhoto }
  | { type: 'illisible'; raison: string }
  | { type: 'credits' }
  | { type: 'quota' }
  | { type: 'hors-ligne' }
  | { type: 'erreur' };

/** Solde affiché sur l'appareil photo ; `cout` vient du serveur (credit_actions), jamais de l'app. */
export type Compteur = { solde: number; cout: number | null; illimite: boolean };

export const MOTIFS_PHOTO = ['mauvais_resultat', 'enonce_mal_lu', 'explication_pas_claire', 'autre'] as const;
export type MotifPhoto = (typeof MOTIFS_PHOTO)[number];

const CLE_MATIERE = 'photo.matiere';
const CLE_EN_COURS = 'photo.enCours';

/** Côté le plus long de l'image envoyée : lisible pour l'IA, ~150 Ko en JPEG 0,7 (réseau 3G). */
export const COTE_MAX = 1280;

export type Cadre = { x: number; y: number; largeur: number; hauteur: number };

/** Cadre en pixels de l'image, borné à l'image, à partir d'un cadre en fractions (0–1). */
export function cadrePixels(fraction: Cadre, largeur: number, hauteur: number): Cadre {
  const x = Math.max(0, Math.min(largeur - 1, Math.round(fraction.x * largeur)));
  const y = Math.max(0, Math.min(hauteur - 1, Math.round(fraction.y * hauteur)));
  return {
    x,
    y,
    largeur: Math.max(1, Math.min(largeur - x, Math.round(fraction.largeur * largeur))),
    hauteur: Math.max(1, Math.min(hauteur - y, Math.round(fraction.hauteur * hauteur))),
  };
}

/** Taille finale après réduction (côté le plus long ≤ COTE_MAX), proportions gardées. */
export function tailleReduite(largeur: number, hauteur: number): { width: number } | { height: number } | null {
  if (Math.max(largeur, hauteur) <= COTE_MAX) return null;
  return largeur >= hauteur ? { width: COTE_MAX } : { height: COTE_MAX };
}

/** Recadre, réduit et compresse la photo ; renvoie le JPEG en base64 et l'adresse locale (aperçu). */
export async function preparerImage(uri: string, fraction: Cadre, largeur: number, hauteur: number): Promise<{ base64: string; uri: string }> {
  const c = cadrePixels(fraction, largeur, hauteur);
  const contexte = ImageManipulator.manipulate(uri).crop({ originX: c.x, originY: c.y, width: c.largeur, height: c.hauteur });
  const taille = tailleReduite(c.largeur, c.hauteur);
  if (taille) contexte.resize(taille);
  const image = await contexte.renderAsync();
  const resultat = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!resultat.base64) throw new Error('Image non encodée');
  return { base64: resultat.base64, uri: resultat.uri };
}

/** Lignes NDJSON complètes du tampon → événements ; renvoie aussi le reste (ligne incomplète). */
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

/** Événement final → issue de l'envoi. */
export function issueDe(e: Evenement): Issue | null {
  if (e.t === 'fin') return { type: 'fin', id: e.id, correction: e.correction };
  if (e.t === 'illisible') return { type: 'illisible', raison: e.raison };
  if (e.t === 'erreur') return { type: 'erreur' };
  return null;
}

type Options = { image: string; matiere: string | null; surEtape: (e: Progression) => void; signal?: AbortSignal };

/**
 * Envoie la photo à la fonction serveur et suit le flux. Les étapes arrivent au fil de l'écriture de l'IA ; la promesse
 * se résout avec l'issue finale. Sans réseau : « hors-ligne » ; solde insuffisant : « credits » ; limite du jour du pass : « quota ».
 */
export async function envoyerPhoto(client: SupabaseClient, { image, matiere, surEtape, signal }: Options): Promise<Issue> {
  const { data } = await client.auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) return { type: 'erreur' };
  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/photo-correction`;
  let reponse: Awaited<ReturnType<typeof fetchFlux>>;
  try {
    reponse = await fetchFlux(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jeton}`, apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, matiere }),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    return { type: 'hors-ligne' };
  }
  if (reponse.status === 402) return { type: 'credits' };
  if (reponse.status === 429) return { type: 'quota' };
  if (!reponse.ok) return { type: 'erreur' };
  const id = reponse.headers.get('X-Correction-Id');
  if (id) await AsyncStorage.setItem(CLE_EN_COURS, id).catch(() => {});

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
    // Coupure en cours de route : la correction continue côté serveur, on la relira avec reprendreCorrection.
    if (id) return (await reprendreCorrection(client, id)) ?? { type: 'hors-ligne' };
    return { type: 'hors-ligne' };
  }
  if (issue) await AsyncStorage.removeItem(CLE_EN_COURS).catch(() => {});
  return issue ?? { type: 'erreur' };
}

type Ligne = { id: string; status: string; result: (CorrectionPhoto & { raison?: string }) | null };

/** Relit une correction enregistrée (après une coupure ou un retour dans l'app). `null` tant qu'elle n'est pas finie. */
export async function reprendreCorrection(client: SupabaseClient, id: string): Promise<Issue | null> {
  const { data, error } = await client.from('photo_corrections').select('id,status,result').eq('id', id).maybeSingle<Ligne>();
  if (error || !data) return null;
  if (data.status === 'done' && data.result) return { type: 'fin', id: data.id, correction: data.result };
  if (data.status === 'unreadable') return { type: 'illisible', raison: data.result?.raison ?? '' };
  if (data.status === 'failed') return { type: 'erreur' };
  return null;
}

/** Correction restée en cours (app fermée pendant l'analyse). */
export const lireCorrectionEnCours = () => AsyncStorage.getItem(CLE_EN_COURS).catch(() => null);
export const oublierCorrectionEnCours = () => AsyncStorage.removeItem(CLE_EN_COURS).catch(() => {});

/** Compteur de l'écran photo (K1, K2b) : solde de crédits, coût d'une question à l'IA, pass en cours. */
export async function lireCompteur(client: SupabaseClient): Promise<Compteur> {
  const [solde, couts] = await Promise.all([lireSolde(client, await identifiantAppareil()), lireCouts(client).catch(() => ({}) as Partial<Record<string, number>>)]);
  return { solde: solde.total, cout: couts.ai_question ?? null, illimite: solde.illimite };
}

export async function noterCorrection(client: SupabaseClient, id: string, avis: 'clair' | 'pas_compris'): Promise<void> {
  const { error } = await client.rpc('rate_photo_correction', { p_id: id, p_feedback: avis });
  if (error) throw error;
}

export async function signalerCorrection(client: SupabaseClient, id: string, motif: MotifPhoto, details: string): Promise<void> {
  const { error } = await client.rpc('report_photo_correction', { p_id: id, p_reason: motif, p_details: details.trim() || null });
  if (error) throw error;
}

export async function lireMatiere(): Promise<MatierePhoto> {
  const m = await AsyncStorage.getItem(CLE_MATIERE).catch(() => null);
  return MATIERES_PHOTO.includes(m as MatierePhoto) ? (m as MatierePhoto) : 'maths';
}
export const retenirMatiere = (m: MatierePhoto) => AsyncStorage.setItem(CLE_MATIERE, m).catch(() => {});

/** Texte de l'IA avec formules entre $…$ → segments (formules dessinées selon le réglage, sinon texte lisible). */
export function segmentsDepuisTexte(texte: string): Segment[] {
  const sortie: Segment[] = [];
  const motif = /\$\$([^$]+)\$\$|\$([^$]+)\$/g;
  let dernier = 0;
  for (const m of texte.matchAll(motif)) {
    if (m.index > dernier) sortie.push({ texte: texte.slice(dernier, m.index) });
    const latex = (m[1] ?? m[2] ?? '').trim();
    sortie.push({ texte: latexVersTexte(latex), math: true, latex });
    dernier = m.index + m[0].length;
  }
  if (dernier < texte.length) sortie.push({ texte: texte.slice(dernier) });
  return sortie.filter((s) => s.texte);
}

/** Paragraphes (séparés par des retours à la ligne) prêts pour `Blocs`. */
export function blocsDepuisTexte(texte: string): Bloc[] {
  return texte
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => ({ type: 'paragraphe', segments: segmentsDepuisTexte(l), retrait: 0 }));
}

/** Correction à partager par WhatsApp (M3-06), formules en texte lisible, avec la marque. */
export function texteDePartage(c: CorrectionPhoto, libelles: { cherche: string; methode: string; resultat: string; retenir: string; signature: string }): string {
  const f = texteAvecFormules;
  const etapes = c.etapes.map((e, i) => `${i + 1}. ${f(e.titre)}${e.detail ? ` : ${f(e.detail)}` : ''}`).join('\n');
  return [
    `*${libelles.cherche}* : ${f(c.enonce)}`,
    c.methode ? `*${libelles.methode}* : ${f(c.methode)}` : '',
    etapes,
    `*${libelles.resultat}* : ${f(c.resultat)}`,
    c.a_retenir ? `*${libelles.retenir}* : ${f(c.a_retenir)}` : '',
    libelles.signature,
  ]
    .filter(Boolean)
    .join('\n\n');
}
