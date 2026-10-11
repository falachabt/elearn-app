import type { Session, SupabaseClient } from '@supabase/supabase-js';

import type { CleTexte } from '@/i18n';

import { suivre } from './analytics';
import { ErreurCompte } from './compte';
import type { Pays } from './profil';

type Client = Pick<SupabaseClient, 'auth'>;

/** Indicatif téléphonique par pays (M1-02 : présélectionné d'après le profil). */
export const INDICATIFS: Record<Pays, string> = { CM: '237', CI: '225', SN: '221', GA: '241', BF: '226', CD: '243', FR: '33' };

/**
 * Numéro au format de l'ancienne app (`normalizePhoneForAuth` d'elearn_mobile) pour retrouver le même utilisateur :
 * chiffres seulement ; « + » ou indicatif déjà présent : gardé tel quel ; sinon l'indicatif du pays est ajouté.
 */
export function normaliserTelephone(brut: string, indicatif = INDICATIFS.CM): string {
  const valeur = brut.trim();
  const chiffres = valeur.replace(/\D/g, '');
  if (!chiffres) return '';
  if (valeur.startsWith('+') || chiffres.startsWith(indicatif)) return `+${chiffres}`;
  return `+${indicatif}${chiffres}`;
}

/** Clé d'erreur sous le champ, ou `null` si le numéro est plausible (8 à 15 chiffres avec l'indicatif). */
export function validerTelephone(brut: string, indicatif = INDICATIFS.CM): CleTexte | null {
  const n = normaliserTelephone(brut, indicatif);
  if (!n) return 'ancien.erreurs.telephoneVide';
  const chiffres = n.length - 1;
  return chiffres >= 8 && chiffres <= 15 ? null : 'ancien.erreurs.telephoneInvalide';
}

/**
 * A7 (M2-06) : les comptes de l'ancienne app sont des comptes Supabase « téléphone + mot de passe » du même projet.
 * On se connecte avec ces identifiants (aucun SMS : gratuit), puis l'élève rattache Google, Apple ou Facebook pour
 * ne plus avoir de mot de passe. Les comptes créés par e-mail sont retrouvés par Google (rapprochement par e-mail).
 */
export async function retrouverAncienCompte(client: Client, p: { telephone: string; motDePasse: string; indicatif?: string }): Promise<Session> {
  const phone = normaliserTelephone(p.telephone, p.indicatif);
  const { data, error } = await client.auth.signInWithPassword({ phone, password: p.motDePasse });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === 'invalid_credentials' || /invalid login credentials/i.test(error.message)) throw new ErreurCompte('ancien.erreurs.identifiants', { cause: error });
    if (code === 'phone_provider_disabled') throw new ErreurCompte('compte.erreurs.methodeIndisponible', { cause: error });
    throw error;
  }
  suivre('connexion_reussie', { methode: 'telephone' });
  return data.session;
}

/** Numéro WhatsApp du support Elearn Prepa (Kapso). Même numéro que sur le site. */
export const SUPPORT_WHATSAPP = '12015348324';

/** Lien WhatsApp vers le support, message prérempli (mot de passe oublié, M2-06 « rattachement assisté »). */
export function lienSupport(message: string): string {
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`;
}
