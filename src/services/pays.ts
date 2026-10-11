import { AsYouType, type CountryCode } from 'libphonenumber-js/min';

import type { PaysPaiement } from './paiementPass';
import { EXEMPLES, INDICATIFS_MONDE, TELEPHONE } from './paysCodes';

/**
 * Liste exhaustive des pays proposés au paiement.
 *
 * Elle vit dans l'application, pas sur le serveur : c'est ce qui permet de choisir son pays — et donc de payer par
 * carte avec Chariow — même quand pawaPay ne répond pas. Avant, la liste venait de pawaPay, donc une panne de pawaPay
 * vidait le sélecteur et bloquait tout le monde, y compris les élèves qui n'allaient pas payer par Mobile Money.
 *
 * Le nom est traduit par `Intl.DisplayNames` (aucune table de noms à maintenir) et le drapeau vient d'un CDN public
 * (`flagcdn.com`, drapeaux du domaine public) : un drapeau par code ISO, sans embarquer 250 images dans l'application.
 * L'indicatif téléphonique n'est pas ici : il n'est utile qu'au Mobile Money, et c'est pawaPay qui le fournit.
 */

/** Codes ISO 3166-1 alpha-2, triés : c'est la liste de référence du sélecteur. */
export const CODES_PAYS: readonly string[] = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ',
  'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ',
  'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR',
  'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY',
  'HK', 'HM', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP',
  'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY',
  'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ',
  'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM',
  'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ',
  'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ',
  'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW',
];

/** `Intl.DisplayNames` est présent sur le web et sur Hermes ; on retombe sur le code si l'environnement l'ignore. */
const Affichage = (Intl as unknown as { DisplayNames?: new (langues: string[], options: { type: string }) => { of(c: string): string | undefined } }).DisplayNames;

/** Pays connus, pour ne pas demander à `Intl` le nom d'un code qui n'existe pas (« région inconnue »). */
const CONNUS = new Set(CODES_PAYS);

/** Nom du pays dans la langue de l'élève, jamais vide. */
export function nomPays(code: string | null | undefined, langue: string): string {
  const propre = (code ?? '').toUpperCase();
  if (!propre || !CONNUS.has(propre)) return propre;
  if (!Affichage) return propre;
  try {
    return new Affichage([langue === 'en' ? 'en' : 'fr'], { type: 'region' }).of(propre) ?? propre;
  } catch {
    return propre;
  }
}

/** Drapeau du pays (CDN public, un fichier par code). `null` pour un code inconnu : la ligne reste sans image. */
export function drapeauPays(code: string | null | undefined): string | null {
  const propre = (code ?? '').toLowerCase();
  return /^[a-z]{2}$/.test(propre) ? `https://flagcdn.com/w40/${propre}.png` : null;
}

/**
 * Exemple de numéro pour ce pays, groupé pour la lecture (« 6 71 23 45 67 »). Il sert d'indication dans le champ et
 * d'exemple dans le message d'erreur : on montre la forme attendue plutôt que de la décrire. Vide si le pays est inconnu.
 */
export function exempleNumero(code: string | null | undefined): string {
  const chiffres = EXEMPLES[(code ?? '').toUpperCase()] ?? '';
  if (!chiffres) return '';
  const paires = chiffres.slice(1).match(/.{1,2}/g) ?? [];
  return [chiffres.slice(0, 1), ...paires].join(' ');
}

/**
 * Mise en forme à la frappe, sans jamais déplacer le curseur.
 *
 * Un champ contrôlé qui réécrit sa valeur pendant une édition au milieu du texte repose le curseur à la fin : c'est le
 * comportement du champ natif, et c'est très pénible pour corriger un chiffre. On ne remet donc en forme que lorsque
 * l'élève écrit à la fin (`v` commence par l'ancien texte) ; toute autre modification est laissée telle quelle, espaces
 * compris, pour que le curseur reste où il est.
 */
export function ajoutEnFin(nouveau: string, ancien: string, code: string | null | undefined): string {
  if (!nouveau.startsWith(ancien)) return nouveau;
  return formaterNumero(nouveau, code);
}

/**
 * Met en forme le numéro au fil de la frappe, selon le pays : au Cameroun « 657273753 » s'écrit « 6 57 27 37 53 ».
 * C'est le formateur officiel de libphonenumber qui s'en charge (245 pays). Pays inconnu ou saisie libre : on rend la
 * saisie telle quelle plutôt que de lutter contre l'élève.
 */
export function formaterNumero(saisie: string, code: string | null | undefined): string {
  const pays = (code ?? '').toUpperCase();
  // Un code inconnu ferait effacer la saisie par le formateur : on ne le lui donne pas.
  if (!CONNUS.has(pays)) return saisie;
  try {
    return new AsYouType(pays as CountryCode).input(saisie);
  } catch {
    return saisie;
  }
}

/**
 * Le numéro ressemble-t-il à un numéro de ce pays ? On vérifie le motif et les longueurs officiels du pays **avant**
 * d'envoyer quoi que ce soit à un opérateur ou à Chariow : un numéro trop court partait jusqu'ici sans contrôle.
 *
 * Deux tolérances : un indicatif saisi par mégarde est retiré (le champ demande le numéro national), et le zéro de
 * tête est accepté (il ne fait pas partie du numéro national, mais tout le monde le tape).
 */
export function numeroPlausible(numero: string, code: string | null | undefined): boolean {
  const chiffres = (numero ?? '').replace(/\D/g, '');
  if (!chiffres) return false;
  const pays = (code ?? '').toUpperCase();
  const regle = TELEPHONE[pays];
  // Pays sans règle connue : on garde la seule borne internationale plausible.
  if (!regle) return chiffres.length >= 6 && chiffres.length <= 15;

  const indicatif = INDICATIFS_MONDE[pays] ?? '';
  const national = indicatif && chiffres.startsWith(indicatif) && chiffres.length > indicatif.length
    ? chiffres.slice(indicatif.length)
    : chiffres;
  const candidats = national.startsWith('0') ? [national, national.replace(/^0+/, '')] : [national];

  return candidats.some((n) => {
    if (!regle.longueurs.includes(n.length)) return false;
    try {
      return new RegExp(`^(?:${regle.motif})$`).test(n);
    } catch {
      return true; // motif illisible : on ne bloque pas l'élève pour autant
    }
  });
}

/**
 * Pays du sélecteur, triés par nom dans la langue de l'élève. `indicatifs` (venus du serveur) complètent l'affichage
 * quand pawaPay répond ; sinon on utilise l'indicatif international, pour que la recherche par numéro marche partout.
 */
export function listerPays(langue: string, indicatifs: Record<string, string> = {}): PaysPaiement[] {
  const collateur = (() => {
    try {
      return new Intl.Collator(langue === 'en' ? 'en' : 'fr', { sensitivity: 'base' });
    } catch {
      return null;
    }
  })();
  return CODES_PAYS.map((alpha2) => ({
    alpha2,
    name: nomPays(alpha2, langue) || alpha2,
    flag: drapeauPays(alpha2),
    prefix: indicatifs[alpha2] ?? INDICATIFS_MONDE[alpha2] ?? '',
    currencies: [],
  })).sort((a, b) => (collateur ? collateur.compare(a.name, b.name) : a.name.localeCompare(b.name)));
}
