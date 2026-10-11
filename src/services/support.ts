import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Vérification du compte pour le support WhatsApp. Quand quelqu'un écrit au support en donnant l'identifiant ou l'e-mail
 * d'un compte, le serveur envoie une notification et une demande en attente (15 minutes). L'élève la confirme ou la refuse
 * ici : c'est la preuve que le compte est bien le sien. Le serveur ne partage rien du compte avant cet accord.
 */
export type DemandeSupport = { id: string; phone_hint: string; created_at: string; expires_at: string };

export type ReponseDemande = 'accepted' | 'refused' | 'expiree' | 'erreur';

type Client = Pick<SupabaseClient, 'rpc'>;
type ClientFonctions = Pick<SupabaseClient, 'functions'>;

/** Demandes en attente du compte connecté, de la plus récente à la plus ancienne. Vide en cas d'erreur (jamais bloquant). */
export async function lireDemandesSupport(client: Client): Promise<DemandeSupport[]> {
  try {
    const { data, error } = await client.rpc('support_auth_pending');
    if (error || !Array.isArray(data)) return [];
    return data.filter(
      (d): d is DemandeSupport => !!d && typeof d.id === 'string' && typeof d.phone_hint === 'string' && typeof d.expires_at === 'string',
    );
  } catch {
    return [];
  }
}

/** Accepte ou refuse une demande. `expiree` : plus de demande en attente avec cet identifiant (déjà répondue ou périmée). */
export async function repondreDemandeSupport(client: ClientFonctions, id: string, accepter: boolean): Promise<ReponseDemande> {
  try {
    const { data, error } = await client.functions.invoke('support-auth-answer', { body: { request_id: id, accept: accepter } });
    if (error) {
      const statut = (error as { context?: { status?: number } }).context?.status;
      return statut === 404 ? 'expiree' : 'erreur';
    }
    const statut = (data as { status?: string } | null)?.status;
    return statut === 'accepted' || statut === 'refused' ? statut : 'erreur';
  } catch {
    return 'erreur';
  }
}

/** Les demandes déjà montrées à l'élève dans cette session : on ne rouvre pas l'écran en boucle. */
const dejaMontrees = new Set<string>();
export const marquerMontree = (id: string) => void dejaMontrees.add(id);
export const premiereDemandeNonMontree = (demandes: DemandeSupport[]): DemandeSupport | null =>
  demandes.find((d) => !dejaMontrees.has(d.id) && new Date(d.expires_at).getTime() > Date.now()) ?? null;
/** Pour les tests. */
export const oublierDemandesMontrees = () => dejaMontrees.clear();
