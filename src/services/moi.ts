import type { SupabaseClient } from '@supabase/supabase-js';

import { suivre } from './analytics';

type Client = Pick<SupabaseClient, 'rpc' | 'from'>;

export type ContactParent = { nom: string | null; telephone: string | null; accord: string | null; retire: string | null };

/** M2-07 : contact du parent ou tuteur de l'élève connecté ; null s'il n'en a jamais donné. */
export async function lireContactParent(client: Client): Promise<ContactParent | null> {
  const { data, error } = await client.from('guardian_contacts').select('name, phone, consent_at, withdrawn_at').maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const l = data as { name: string | null; phone: string | null; consent_at: string | null; withdrawn_at: string | null };
  return { nom: l.name, telephone: l.phone, accord: l.consent_at, retire: l.withdrawn_at };
}

/** Enregistre le contact ; l'accord est daté par le serveur. Le numéro est déjà normalisé (+indicatif). */
export async function enregistrerContactParent(client: Client, p: { nom: string; telephone: string; accord: boolean }): Promise<ContactParent> {
  const { data, error } = await client.rpc('save_guardian_contact', { p_name: p.nom, p_phone: p.telephone, p_consent: p.accord });
  if (error) throw error;
  suivre('guardian_contact_saved', {});
  const l = data as { name: string | null; phone: string | null; consent_at: string | null; withdrawn_at: string | null };
  return { nom: l.name, telephone: l.phone, accord: l.consent_at, retire: l.withdrawn_at };
}

export async function retirerContactParent(client: Client): Promise<void> {
  const { error } = await client.rpc('withdraw_guardian_contact');
  if (error) throw error;
  suivre('guardian_contact_withdrawn', {});
}

/** M2-08 : date de la demande de suppression en cours, ou null. */
export async function lireDemandeSuppression(client: Client): Promise<string | null> {
  const { data, error } = await client.from('account_deletion_requests').select('requested_at, processed_at').maybeSingle();
  if (error) throw error;
  const l = data as { requested_at: string; processed_at: string | null } | null;
  return l && !l.processed_at ? l.requested_at : null;
}

export async function demanderSuppression(client: Client, motif?: string): Promise<string> {
  const { data, error } = await client.rpc('request_account_deletion', { p_reason: motif?.trim() || null });
  if (error) throw error;
  suivre('account_deletion_requested', {});
  return data as string;
}

export async function annulerSuppression(client: Client): Promise<void> {
  const { error } = await client.rpc('cancel_account_deletion');
  if (error) throw error;
}

/** Date limite d'effacement affichée à l'élève (30 jours après la demande). */
export function dateEffacement(demande: string): Date {
  return new Date(new Date(demande).getTime() + 30 * 24 * 3600 * 1000);
}
