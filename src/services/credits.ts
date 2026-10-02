import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { suivre } from './analytics';

type Client = Pick<SupabaseClient, 'from' | 'rpc' | 'channel' | 'removeChannel'>;

/** Actions payantes en crédits (M18). Les coûts viennent du serveur (credit_actions), jamais de l'app. */
export type ActionCredit = 'quiz_explanation' | 'exercise_solution' | 'document_pdf' | 'exam_correction' | 'ai_question';

export type Solde = {
  total: number;
  semaine: number;
  recompenses: number;
  /** Montant de la recharge du lundi (jauge « 7 / 25 »). */
  recharge: number;
  prochaineRecharge: string;
  /** Faux pour un invité ou un compte au-delà de la limite par appareil. */
  rechargeHebdo: boolean;
  illimite: boolean;
  illimiteJusqua: string | null;
  expirationRecompenses: string | null;
};

/**
 * Résultat de `depenser_credits` :
 * - unlimited : pass en cours, rien n'est débité ; already : déjà débloqué ; free : gratuit ; spent : débité ;
 * - insufficient : solde trop bas (contenu null) ; limit : limite de questions à l'IA du pass atteinte (contenu null).
 */
export type StatutDepense = 'unlimited' | 'already' | 'free' | 'spent' | 'insufficient' | 'limit';
export type Depense<C = Record<string, unknown>> = { statut: StatutDepense; cout: number; solde: number; contenu: C | null };

export const CLE_APPAREIL = 'credits.appareil';

/**
 * Identifiant de l'appareil pour le bonus de bienvenue (une fois par appareil) et la limite de comptes par appareil
 * (M18-03). Le serveur le hache. Android : ANDROID_ID ; iOS : identifiant fournisseur ; sinon un tirage gardé en local.
 */
export async function identifiantAppareil(): Promise<string> {
  try {
    const natif = Platform.OS === 'android' ? Application.getAndroidId() : Platform.OS === 'ios' ? await Application.getIosIdForVendorAsync() : null;
    if (natif) return `${Platform.OS}:${natif}`;
  } catch {
    // Repli ci-dessous.
  }
  const garde = await AsyncStorage.getItem(CLE_APPAREIL).catch(() => null);
  if (garde) return garde;
  const tire = `local:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  await AsyncStorage.setItem(CLE_APPAREIL, tire).catch(() => {});
  return tire;
}

type LigneSolde = {
  balance: number;
  weekly_left: number;
  reward_left: number;
  weekly_amount: number;
  next_refill_at: string;
  weekly_refill: boolean;
  unlimited: boolean;
  unlimited_until: string | null;
  next_reward_expiry: string | null;
};

/** Solde de l'élève connecté. Le serveur fait la recharge du lundi et le bonus de bienvenue au passage. */
export async function lireSolde(client: Client, appareil: string | null): Promise<Solde> {
  const { data, error } = await client.rpc('my_credits', { p_device: appareil });
  if (error) throw error;
  const l = (data as LigneSolde[] | null)?.[0];
  if (!l) throw new Error('solde introuvable');
  return {
    total: l.balance,
    semaine: l.weekly_left,
    recompenses: l.reward_left,
    recharge: l.weekly_amount,
    prochaineRecharge: l.next_refill_at,
    rechargeHebdo: l.weekly_refill,
    illimite: l.unlimited,
    illimiteJusqua: l.unlimited_until,
    expirationRecompenses: l.next_reward_expiry,
  };
}

export type ReglagesCredits = { bienvenue: number; invite: number; recharge: number };

/** Montants du back-office (bienvenue, invité, recharge du lundi) : lisibles sans compte, jamais écrits en dur dans les textes. */
export async function lireReglages(client: Client): Promise<ReglagesCredits> {
  const { data, error } = await client.from('credit_settings').select('welcome_amount, guest_amount, weekly_amount').limit(1).maybeSingle();
  if (error) throw error;
  const l = data as { welcome_amount: number; guest_amount: number; weekly_amount: number } | null;
  if (!l) throw new Error('réglages introuvables');
  return { bienvenue: l.welcome_amount, invite: l.guest_amount, recharge: l.weekly_amount };
}

/**
 * Bonus de bienvenue reçu depuis `depuis` (ISO) : identifiant de la ligne et montant, ou null s'il n'y en a pas (compte déjà ancien, bonus déjà
 * pris sur ce téléphone). Lu dans le registre de l'élève (lecture limitée à ses lignes).
 */
export async function lireBienvenueRecente(client: Client, depuis: string): Promise<{ id: string; montant: number } | null> {
  const { data, error } = await client
    .from('credit_ledger')
    .select('id, delta')
    .eq('kind', 'welcome')
    .gt('delta', 0)
    .gte('created_at', depuis)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const l = (data as { id: number | string; delta: number }[] | null)?.[0];
  return l ? { id: String(l.id), montant: l.delta } : null;
}

/** Coût de chaque action active, pour afficher le prix avant d'agir (M18-07). */
export async function lireCouts(client: Client): Promise<Partial<Record<ActionCredit, number>>> {
  const { data, error } = await client.from('credit_actions').select('code, cost');
  if (error) throw error;
  return Object.fromEntries(((data ?? []) as { code: ActionCredit; cost: number }[]).map((l) => [l.code, l.cost]));
}

/**
 * M18-04 : seule porte vers un contenu payant (explication, corrigé, adresse de PDF). Le serveur vérifie le pass, un
 * déblocage existant puis le solde, débite une seule fois et renvoie le contenu. `objet` : identifiant de l'élément.
 */
export async function depenser<C = Record<string, unknown>>(client: Client, action: ActionCredit, objet: string | number): Promise<Depense<C>> {
  const { data, error } = await client.rpc('depenser_credits', { p_action: action, p_ref: String(objet) });
  if (error) throw error;
  const l = (data as { status: StatutDepense; cost: number; balance: number; content: C | null }[] | null)?.[0];
  if (!l) throw new Error('réponse vide');
  if (l.status === 'spent') suivre('credits_spent', { action, cout: l.cost, solde: l.balance });
  if (l.status === 'insufficient') suivre('credits_exhausted', { action, cout: l.cost, solde: l.balance });
  return { statut: l.status, cout: l.cost, solde: l.balance, contenu: l.content };
}

/** Le contenu est-il déjà ouvert pour cet élève (pass, déjà débloqué, gratuit) ? Ne dépense rien. */
export async function peutVoir(client: Client, action: ActionCredit, objet: string | number): Promise<boolean> {
  const { data, error } = await client.rpc('can_view', { p_action: action, p_ref: String(objet) });
  if (error) throw error;
  return data === true;
}

/** Parmi `refs`, ceux déjà ouverts par l'élève (jamais redemandés) : exercice, document, PDF de correction. */
export async function lireOuverts(client: Client, action: ActionCredit, refs: string[]): Promise<Set<string>> {
  if (!refs.length) return new Set();
  const { data, error } = await client.rpc('my_unlocked_refs', { p_action: action, p_refs: refs });
  if (error) throw error;
  return new Set(((data ?? []) as string[]).map(String));
}

/** Documents gratuits qu'il reste à l'élève (credit_settings.free_documents moins ceux déjà ouverts gratuitement). */
export async function lireDocumentsGratuits(client: Client): Promise<number> {
  const { data, error } = await client.rpc('my_free_documents_left');
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

type LigneTempsReel = { weekly_left: number; reward_left: number; next_refill_at: string; unlimited_until: string | null };

/** Applique une ligne credit_balances reçue en temps réel au solde connu (M18-06). */
export function appliquerTempsReel(solde: Solde, ligne: LigneTempsReel, maintenant = new Date()): Solde {
  const illimite = !!ligne.unlimited_until && new Date(ligne.unlimited_until) > maintenant;
  return {
    ...solde,
    total: ligne.weekly_left + ligne.reward_left,
    semaine: ligne.weekly_left,
    recompenses: ligne.reward_left,
    prochaineRecharge: ligne.next_refill_at,
    illimite,
    illimiteJusqua: illimite ? ligne.unlimited_until : null,
  };
}

/** S'abonne aux changements du solde de l'élève. Renvoie la fonction d'arrêt. */
export function suivreSolde(client: Client, utilisateur: string, surChangement: (ligne: LigneTempsReel) => void): () => void {
  const canal = client
    .channel(`credits:${utilisateur}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_balances', filter: `user_id=eq.${utilisateur}` }, (charge) => {
      const ligne = charge.new as Partial<LigneTempsReel> | undefined;
      if (ligne && typeof ligne.weekly_left === 'number' && typeof ligne.reward_left === 'number') surChangement(ligne as LigneTempsReel);
    })
    .subscribe();
  return () => {
    client.removeChannel(canal);
  };
}

/** Seuil de confirmation : à partir de ce coût, une feuille demande l'accord avant de dépenser (M18-07). */
export const SEUIL_CONFIRMATION = 3;

/** Délai jusqu'à une date, découpé pour l'affichage du compte à rebours (« 2 j 5 h », « 3 h 20 min »). */
export function delaiJusqua(cible: string, maintenant = new Date()): { jours: number; heures: number; minutes: number } {
  const ms = Math.max(0, new Date(cible).getTime() - maintenant.getTime());
  const minutesTotales = Math.ceil(ms / 60000);
  return { jours: Math.floor(minutesTotales / 1440), heures: Math.floor((minutesTotales % 1440) / 60), minutes: minutesTotales % 60 };
}

export type Semaine = { recharge: number; bienvenue: number; recompenses: number; depenses: number };

/** Répartition de la semaine en cours (K1b) : recharges, bonus, récompenses et dépenses depuis lundi. */
export async function lireSemaine(client: Client, prochaineRecharge: string): Promise<Semaine> {
  const debut = new Date(new Date(prochaineRecharge).getTime() - 7 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await client.from('credit_ledger').select('delta, kind').gte('created_at', debut);
  if (error) throw error;
  const s: Semaine = { recharge: 0, bienvenue: 0, recompenses: 0, depenses: 0 };
  for (const l of (data ?? []) as { delta: number; kind: string }[]) {
    if (l.kind === 'weekly' || l.kind === 'guest') s.recharge += l.delta;
    else if (l.kind === 'welcome') s.bienvenue += l.delta;
    else if (l.kind === 'reward') s.recompenses += l.delta;
    else if (l.kind === 'spend' || l.kind === 'refund') s.depenses -= l.delta;
  }
  return s;
}
