import type { User } from '@supabase/supabase-js';

/** Identité lisible depuis le compte (connexion Google : nom complet et photo de profil). */
export type Identite = { nom: string | null; prenom: string | null; photo: string | null };

const texte = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Nom, prénom et photo du compte, sans rien demander à l'élève : les fournisseurs de connexion (Google, Facebook,
 * Apple) les donnent dans `user_metadata`. Un compte par e-mail sans nom renvoie des null : l'app n'affiche alors
 * que l'initiale ou un accueil sans nom.
 */
export function identiteDe(user: Pick<User, 'user_metadata'> | null | undefined): Identite {
  const m = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const nom = texte(m.full_name) ?? texte(m.name) ?? ([texte(m.given_name), texte(m.family_name)].filter(Boolean).join(' ') || null);
  const prenom = texte(m.given_name) ?? nom?.split(/\s+/)[0] ?? null;
  const photoBrute = texte(m.avatar_url) ?? texte(m.picture);
  // Seules les adresses https sont affichées (jamais un chemin local ou un schéma inattendu).
  const photo = photoBrute && /^https:\/\//i.test(photoBrute) ? photoBrute : null;
  return { nom, prenom, photo };
}
