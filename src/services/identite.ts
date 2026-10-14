import type { User } from '@supabase/supabase-js';

/** Identité lisible depuis le compte (connexion Google : nom complet et photo de profil). */
export type Identite = { nom: string | null; prenom: string | null; photo: string | null };

const texte = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Extrait un nom d'affichage propre à partir de l'adresse email lorsque le fournisseur
 * ou le compte ne fournit pas de `full_name` explicite (ex: compte email/password).
 */
export function nomDepuisEmail(email?: string | null): string | null {
  if (!email || !email.includes('@')) return null;
  const partie = email.split('@')[0].trim();
  const nettoye = partie
    .replace(/[._-]+/g, ' ')
    .replace(/\d+/g, '')
    .trim();
  if (nettoye.length >= 2) {
    return nettoye
      .split(/\s+/)
      .map((mot) => mot.charAt(0).toUpperCase() + mot.slice(1).toLowerCase())
      .join(' ');
  }
  return partie ? partie.charAt(0).toUpperCase() + partie.slice(1) : null;
}

/**
 * Nom, prénom et photo du compte, sans rien demander à l'élève : les fournisseurs de connexion (Google, Facebook,
 * Apple) les donnent dans `user_metadata`. Si aucun nom complet n'est fourni, l'e-mail est utilisé pour déduire
 * un nom propre afin de ne jamais afficher « Invité » pour un élève connecté.
 */
export function identiteDe(user: (Pick<User, 'user_metadata'> & { email?: string | null }) | null | undefined): Identite {
  const m = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const nomMeta =
    texte(m.full_name) ??
    texte(m.name) ??
    texte(m.display_name) ??
    texte(m.username) ??
    texte(m.preferred_username) ??
    ([texte(m.given_name), texte(m.family_name)].filter(Boolean).join(' ') || null);
  const nom = nomMeta ?? (user?.email ? nomDepuisEmail(user.email) : (m.email ? nomDepuisEmail(texte(m.email)) : null));
  const prenom = texte(m.given_name) ?? nom?.split(/\s+/)[0] ?? null;
  const photoBrute = texte(m.avatar_url) ?? texte(m.picture);
  // Seules les adresses https sont affichées (jamais un chemin local ou un schéma inattendu).
  const photo = photoBrute && /^https:\/\//i.test(photoBrute) ? photoBrute : null;
  return { nom, prenom, photo };
}
