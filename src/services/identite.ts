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
export function identiteDe(
  user:
    | (Pick<User, 'user_metadata'> & {
        email?: string | null;
        identities?: Array<{ identity_data?: Record<string, unknown> | null }> | null;
      })
    | null
    | undefined
): Identite {
  const m = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const donneesIdentites = (user?.identities ?? []).map((i) => (i?.identity_data ?? {}) as Record<string, unknown>);

  const chercherChamp = (cle: string): string | null => {
    if (texte(m[cle])) return texte(m[cle]);
    for (const d of donneesIdentites) {
      if (texte(d[cle])) return texte(d[cle]);
    }
    return null;
  };

  const nomMeta =
    chercherChamp('full_name') ??
    chercherChamp('name') ??
    chercherChamp('display_name') ??
    chercherChamp('username') ??
    chercherChamp('preferred_username') ??
    ([chercherChamp('given_name'), chercherChamp('family_name')].filter(Boolean).join(' ') || null);

  const emailCompte = user?.email ?? chercherChamp('email');
  const nom = nomMeta ?? (emailCompte ? nomDepuisEmail(emailCompte) : null);
  const prenom = chercherChamp('given_name') ?? nom?.split(/\s+/)[0] ?? null;

  const extrairePhotoObj = (obj: Record<string, unknown>): string | null => {
    const p = obj.picture;
    if (p && typeof p === 'object' && 'data' in p && typeof (p as { data?: { url?: unknown } }).data?.url === 'string') {
      return texte((p as { data: { url: string } }).data.url);
    }
    return null;
  };

  const photoBrute =
    chercherChamp('avatar_url') ??
    chercherChamp('picture') ??
    chercherChamp('photo_url') ??
    chercherChamp('photoURL') ??
    chercherChamp('avatar') ??
    chercherChamp('image') ??
    extrairePhotoObj(m) ??
    donneesIdentites.map(extrairePhotoObj).find(Boolean) ??
    null;

  // Seules les adresses http(s) sont affichées (jamais un chemin local ou un schéma inattendu).
  const photo = photoBrute && /^https?:\/\//i.test(photoBrute) ? photoBrute : null;
  return { nom, prenom, photo };
}
