/**
 * Garde-fou de vie privée des évènements d'analytics : rien de ce qui identifie une personne ou révèle le contenu
 * d'une question ne doit partir vers PostHog, même par erreur d'un appelant ou dans un message d'exception.
 */

/** Propriétés retirées quel que soit leur contenu (comparées sans casse, sans tirets ni soulignés). */
const CLES_INTERDITES = [
  'email',
  'mail',
  'phone',
  'telephone',
  'numero',
  'tel',
  'password',
  'motdepasse',
  'mdp',
  'token',
  'jeton',
  'secret',
  'authorization',
  'apikey',
  'otp',
  'codesms',
  'texte',
  'contenu',
  'question',
  'reponse',
  'enonce',
  'prenom',
  'nomcomplet',
  'adresse',
];

const normaliser = (cle: string) => cle.toLowerCase().replace(/[_-]/g, '');
const INTERDITES = new Set(CLES_INTERDITES.map(normaliser));

const LONGUEUR_MAX = 300;
const PROFONDEUR_MAX = 6;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Numéro de téléphone isolé : +237 6 12 34 56 78, 237612345678, 612345678. Les suites de chiffres collées à des lettres
// ou à un tiret (identifiants, UUID) ne sont pas touchées.
const TELEPHONE = /(?<![\w-])\+?\d(?:[ .]?\d){8,14}(?![\w-])/g;
const JETON_LONG = /\b(?:eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}|sk_\w{16,}|phc_\w{16,})\b/g;

/** Remplace e-mails, numéros de téléphone et jetons par un repère neutre. */
export function masquer(texte: string): string {
  return texte.replace(JETON_LONG, '[jeton]').replace(EMAIL, '[email]').replace(TELEPHONE, '[numero]');
}

export function estCleInterdite(cle: string): boolean {
  return INTERDITES.has(normaliser(cle));
}

/** Copie nettoyée : clés interdites retirées, chaînes masquées et tronquées, profondeur bornée. */
export function assainir<T>(valeur: T, profondeur = 0): T {
  if (typeof valeur === 'string') {
    const m = masquer(valeur);
    return (m.length > LONGUEUR_MAX ? m.slice(0, LONGUEUR_MAX) : m) as T;
  }
  if (valeur === null || typeof valeur !== 'object') return valeur;
  if (profondeur >= PROFONDEUR_MAX) return undefined as T;
  if (Array.isArray(valeur)) return valeur.map((v) => assainir(v, profondeur + 1)) as T;
  const sortie: Record<string, unknown> = {};
  for (const [cle, v] of Object.entries(valeur as Record<string, unknown>)) {
    // Les champs d'exception de PostHog ($exception_list, piles) gardent leur forme : seul leur texte est masqué.
    if (cle[0] !== '$' && estCleInterdite(cle)) continue;
    sortie[cle] = assainir(v, profondeur + 1);
  }
  return sortie as T;
}
