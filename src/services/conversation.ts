import type { SupabaseClient } from '@supabase/supabase-js';
import { fetch as fetchFlux } from 'expo/fetch';

import type { BlocChat } from './laboChat';

/**
 * Conversation (chat interactif) : envoi d'une question écrite — éventuellement accompagnée de photos — à la
 * fonction serveur « conversation » (flux NDJSON), qui fait répondre Gemma 4 en blocs typés (texte, correction
 * structurée, pendule, fonction). Même transport que la correction par photo (services/photo.ts). Aucune clé
 * d'IA dans l'app : tout passe par la fonction Edge.
 */

/**
 * Étapes de progression émises par la fonction pendant le traitement, dans l'ordre où elles surviennent :
 * avec photo — lecture, analyse, rédaction ; question écrite — réflexion, rédaction, et « visuel » juste avant
 * la réponse quand elle contient un bloc interactif à préparer.
 */
export type EtapeConversation = 'lecture' | 'analyse' | 'reflexion' | 'redaction' | 'visuel';

export type EvenementConversation =
  | { t: 'etape'; etape: EtapeConversation }
  | { t: 'fin'; blocs: BlocChat[]; modele: string; repli: boolean }
  | { t: 'erreur'; code: string };

export type IssueConversation =
  | { type: 'fin'; blocs: BlocChat[]; repli: boolean }
  | { type: 'limite'; minutes: number | null }
  | { type: 'hors-ligne' }
  | { type: 'erreur' };

const BORNES_PENDULE = { longueur: [0.2, 3], amplitudeDeg: [5, 60], pesanteur: [1.6, 25] } as const;

const nombre = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const chaine = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const plafonner = (v: number, bornes: readonly [number, number]): number => Math.min(bornes[1], Math.max(bornes[0], v));

/**
 * Blocs reçus → blocs sûrs pour l'écran. La fonction valide déjà côté serveur ; l'app revérifie par prudence :
 * types connus seulement, paramètres du pendule plafonnés dans les bornes des curseurs, au plus un bloc
 * interactif, au plus une correction (rubriques et étapes bornées), et au moins un bloc texte ou une
 * correction (sinon la réponse est inexploitable).
 */
export function blocsSurs(bruts: unknown): BlocChat[] {
  if (!Array.isArray(bruts)) return [];
  const blocs: BlocChat[] = [];
  let interactif = false;
  let correctionFaite = false;
  for (const brut of bruts) {
    if (!brut || typeof brut !== 'object') continue;
    const b = brut as Record<string, unknown>;
    if (b.type === 'texte') {
      const texte = typeof b.texte === 'string' ? b.texte.trim().slice(0, 2000) : '';
      if (texte) blocs.push({ type: 'texte', texte });
    } else if (b.type === 'correction') {
      if (correctionFaite) continue;
      const enonce = chaine(b.enonce, 800);
      const methode = chaine(b.methode, 1000);
      const resultat = chaine(b.resultat, 800);
      const aRetenir = chaine(b.aRetenir, 800);
      const etapes = (Array.isArray(b.etapes) ? b.etapes.slice(0, 8) : [])
        .map((e) => {
          const o = (e ?? {}) as Record<string, unknown>;
          return { titre: chaine(o.titre, 160), detail: chaine(o.detail, 1000) };
        })
        .filter((e) => e.titre || e.detail);
      if (!enonce || !methode || !resultat || etapes.length === 0) continue;
      correctionFaite = true;
      const bloc: Extract<BlocChat, { type: 'correction' }> = { type: 'correction', enonce, methode, etapes, resultat };
      if (aRetenir) bloc.aRetenir = aRetenir;
      blocs.push(bloc);
    } else if (b.type === 'pendule') {
      if (interactif) continue;
      interactif = true;
      const bloc: Extract<BlocChat, { type: 'pendule' }> = { type: 'pendule' };
      const longueur = nombre(b.longueur);
      const amplitude = nombre(b.amplitudeDeg);
      const pesanteur = nombre(b.pesanteur);
      if (longueur !== null) bloc.longueur = plafonner(longueur, BORNES_PENDULE.longueur);
      if (amplitude !== null) bloc.amplitudeDeg = plafonner(amplitude, BORNES_PENDULE.amplitudeDeg);
      if (pesanteur !== null) bloc.pesanteur = plafonner(pesanteur, BORNES_PENDULE.pesanteur);
      blocs.push(bloc);
    } else if (b.type === 'fonction') {
      if (interactif) continue;
      const a = nombre(b.a);
      const bb = nombre(b.b);
      const c = nombre(b.c);
      if (a === null || a === 0 || bb === null || c === null) continue;
      interactif = true;
      blocs.push({ type: 'fonction', a, b: bb, c });
    }
    if (blocs.length >= 8) break;
  }
  return blocs.some((b) => b.type === 'texte' || b.type === 'correction') ? blocs : [];
}

/** Lignes NDJSON complètes du tampon → événements ; renvoie aussi le reste (ligne incomplète). */
export function lireLignesConversation(tampon: string): { evenements: EvenementConversation[]; reste: string } {
  const lignes = tampon.split('\n');
  const reste = lignes.pop() ?? '';
  const evenements: EvenementConversation[] = [];
  for (const l of lignes) {
    if (!l.trim()) continue;
    try {
      const e = JSON.parse(l) as EvenementConversation;
      if (e && typeof e === 'object' && 't' in e) evenements.push(e);
    } catch {
      // ligne illisible : ignorée
    }
  }
  return { evenements, reste };
}

type Options = {
  question?: string | null;
  /** Photos JPEG en base64 (mode mixte : une ou plusieurs), sans préfixe data:. */
  images?: string[] | null;
  surEtape?: (e: EtapeConversation) => void;
  signal?: AbortSignal;
};

/**
 * Pose la question à la fonction serveur et suit le flux. Sans session ou sans réseau : issue explicite, pour
 * que l'écran affiche son repli libellé plutôt qu'un échec silencieux.
 */
export async function demanderConversation(client: SupabaseClient, { question, images, surEtape, signal }: Options): Promise<IssueConversation> {
  const { data } = await client.auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) return { type: 'erreur' };

  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/conversation`;
  let reponse: Awaited<ReturnType<typeof fetchFlux>>;
  try {
    reponse = await fetchFlux(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jeton}`, apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question ?? null, images: images?.length ? images : null }),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    return { type: 'hors-ligne' };
  }
  if (reponse.status === 429) {
    const corps = (await reponse.json().catch(() => ({}))) as { code?: string; reessayez_dans_minutes?: number };
    if (corps.code === 'limite') return { type: 'limite', minutes: corps.reessayez_dans_minutes ?? null };
    return { type: 'erreur' };
  }
  if (!reponse.ok) return { type: 'erreur' };

  let tampon = '';
  let issue: IssueConversation | null = null;
  const traiter = (texte: string) => {
    const { evenements, reste } = lireLignesConversation(texte);
    tampon = reste;
    for (const e of evenements) {
      if (e.t === 'etape') surEtape?.(e.etape);
      else if (e.t === 'fin') {
        const blocs = blocsSurs(e.blocs);
        issue = blocs.length ? { type: 'fin', blocs, repli: !!e.repli } : { type: 'erreur' };
      } else if (e.t === 'erreur') issue = { type: 'erreur' };
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
    return { type: 'hors-ligne' };
  }
  return issue ?? { type: 'erreur' };
}
