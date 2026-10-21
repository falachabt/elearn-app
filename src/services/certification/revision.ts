import { lireProfil } from '../profil';
import { obtenirApi } from './api';
import { lireAvecCopie } from './copie';
import type { EtatMaitrise } from './certMaitrise';
import { etatMot, type EtatMot } from './certCarnet';
import { jourDe, type Jour } from './jours';
import type { FamilleNotion, MotCarnetServi, NotionFiche, NotionListee, PartieMaitrise, Revision } from './types';

/** Clés locales du contenu de révision (AGENTS.md §16 bis : lues seulement par `lireAvecCopie`, donc soumises à l'expiration). */
export const CLE_REVISION = (exam: string) => `cert.cache.revision.${exam}`;
export const CLE_CARNET = (exam: string) => `cert.cache.carnet.${exam}`;
export const CLE_FICHE = (id: string) => `cert.cache.fiche.${id}`;

export const chargerRevision = (exam: string, jour: Jour) => lireAvecCopie<Revision>(CLE_REVISION(exam), () => obtenirApi().lireRevision(exam, jour));
export const chargerCarnet = (exam: string) => lireAvecCopie<MotCarnetServi[]>(CLE_CARNET(exam), () => obtenirApi().lireCarnet(exam));
export const chargerFiche = (id: string) => lireAvecCopie<NotionFiche>(CLE_FICHE(id), () => obtenirApi().lireNotion(id));

// Notions ----------------------------------------------------------------------------------------------------------

/** Fragile, En progrès, Pas commencée, Acquise (C3). */
const RANG_ETAT: Record<EtatMaitrise, number> = { fragile: 0, en_progres: 1, pas_commencee: 2, acquise: 3 };

/** Notions d'une partie, triées par état puis ordre du référentiel (l'ordre reçu du serveur). */
export function notionsDeLaPartie(notions: NotionListee[], partie: number): NotionListee[] {
  return notions
    .map((n, ordre) => ({ n, ordre }))
    .filter(({ n }) => n.parties.includes(partie))
    .sort((a, b) => RANG_ETAT[a.n.etat] - RANG_ETAT[b.n.etat] || a.ordre - b.ordre)
    .map(({ n }) => n);
}

/** « M'entraîner sur … » cible la notion la plus fragile : la première de la liste triée. */
export const notionLaPlusFragile = (notions: NotionListee[], partie: number): NotionListee | null => notionsDeLaPartie(notions, partie)[0] ?? null;

/** Totaux par état de la carte de maîtrise : ils comptent des notions, pas des parties (F4). */
export function totauxParEtat(notions: NotionListee[]): Record<EtatMaitrise, number> {
  const t: Record<EtatMaitrise, number> = { acquise: 0, en_progres: 0, fragile: 0, pas_commencee: 0 };
  for (const n of notions) t[n.etat]++;
  return t;
}

/** Partie de plus faible maîtrise parmi celles qui ont des réponses ; `null` tant qu'aucune n'en a (S7). */
export function partieLaPlusFaible(parties: PartieMaitrise[]): number | null {
  const avecReponses = parties.filter((p) => p.reponses > 0);
  if (avecReponses.length === 0) return null;
  return [...avecReponses].sort((a, b) => a.m - b.m || a.partie - b.partie)[0].partie;
}

/** Notions fragiles, pour la phrase « 3 notions fragiles ». */
export const nombreFragiles = (notions: NotionListee[]): number => notions.filter((n) => n.etat === 'fragile').length;

export type GroupeCours = { partie: number; notions: NotionListee[] };

/** C4 : un onglet = une famille ; les notions sans fiche publiée n'apparaissent pas (AC-C4-2), groupées par première partie. */
export function coursDeLaFamille(notions: NotionListee[], famille: FamilleNotion): GroupeCours[] {
  const groupes = new Map<number, NotionListee[]>();
  for (const n of notions) {
    if (!n.fiche || n.famille !== famille) continue;
    const partie = n.parties.length ? Math.min(...n.parties) : 0;
    groupes.set(partie, [...(groupes.get(partie) ?? []), n]);
  }
  return [...groupes.entries()].sort((a, b) => a[0] - b[0]).map(([partie, liste]) => ({ partie, notions: liste }));
}

export const nombreDeFiches = (notions: NotionListee[]): number => notions.filter((n) => n.fiche).length;

// Fiche d'une notion (C5) -----------------------------------------------------------------------------------------

export type FicheLue = {
  regle: string | null;
  exemples: { en: string; fr: string | null }[];
  piege: string | null;
  fauxAmi: string | null;
};

/** Étiquette de section en gras, avec le reste du paragraphe éventuel sur la même ligne. */
const ETIQUETTE = /^\*\*([^*]+?)\s*[.:]?\s*\*\*\s*(.*)$/;

const SECTIONS: Record<string, keyof FicheLue> = { 'règle': 'regle', regle: 'regle', exemples: 'exemples', 'piège': 'piege', piege: 'piege', 'faux ami': 'fauxAmi' };

/**
 * Lit le texte d'une fiche. Format contrôlé, en quatre sections `## Règle`, `## Exemples` (une ligne par exemple :
 * `- anglais | français`, mots à mettre en valeur entre `**`), `## Piège`, `## Faux ami` (`mot | sens`). Toute autre
 * structure est ignorée : aucun HTML ni lien n'est rendu.
 */
export function lireFiche(markdown: string | null): FicheLue {
  const fiche: FicheLue = { regle: null, exemples: [], piege: null, fauxAmi: null };
  if (!markdown) return fiche;
  let section: keyof FicheLue | null = null;
  const texte: Partial<Record<keyof FicheLue, string[]>> = {};
  for (const brut of markdown.split(/\r?\n/)) {
    const titre = /^##\s+(.+?)\s*$/.exec(brut);
    if (titre) {
      section = SECTIONS[titre[1].toLowerCase()] ?? null;
      continue;
    }
    // Format de la banque : chaque section commence par une étiquette en gras (« **Règle.** », « **Piège TOEIC.** »).
    const etiquette = ETIQUETTE.exec(brut.trim());
    if (etiquette) {
      section = SECTIONS[etiquette[1].replace(/\s*toeic\s*$/i, '').trim().toLowerCase()] ?? null;
      if (section && etiquette[2].trim()) (texte[section] ??= []).push(etiquette[2].trim());
      continue;
    }
    if (!section || !brut.trim()) continue;
    (texte[section] ??= []).push(brut.trim());
  }
  fiche.regle = texte.regle?.join(' ') ?? null;
  fiche.piege = texte.piege?.join(' ') ?? null;
  const faux = texte.fauxAmi?.[0];
  if (faux) {
    const [mot, sens] = faux.split('|').map((x) => x.trim());
    fiche.fauxAmi = sens ? `${mot} ≠ ${sens}` : mot;
  }
  for (const l of texte.exemples ?? []) {
    // Prose de la banque : « anglais » (français), plusieurs exemples possibles dans une même ligne.
    const paires = [...l.matchAll(/«\s*([^»]+?)\s*»(?:\s*\(([^)]*)\))?/g)];
    if (paires.length > 0) {
      for (const p of paires) fiche.exemples.push({ en: p[1], fr: p[2]?.trim() || null });
      continue;
    }
    const [en, fr] = l.replace(/^[-*]\s+/, '').split('|').map((x) => x.trim());
    if (en) fiche.exemples.push({ en, fr: fr || null });
  }
  return fiche;
}

/** Découpe une phrase en morceaux normaux et mis en valeur (`**mot**`), sans rien interpréter d'autre. */
export function morceauxMisEnValeur(phrase: string): { texte: string; fort: boolean }[] {
  return phrase.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((m) => (m.startsWith('**') && m.endsWith('**') ? { texte: m.slice(2, -2), fort: true } : { texte: m, fort: false }));
}

// Carnet (C6) ------------------------------------------------------------------------------------------------------

/** Minuscules, sans accents ni espaces de bord : la recherche ignore la casse et les accents (AC-C6-3). */
export const normaliser = (t: string): string => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export function chercherMots(mots: MotCarnetServi[], requete: string): MotCarnetServi[] {
  const q = normaliser(requete);
  if (!q) return mots;
  return mots.filter((m) => normaliser(m.mot).includes(q) || normaliser(m.definition).includes(q));
}

export function motsParEtat(mots: MotCarnetServi[], etat: EtatMot): MotCarnetServi[] {
  return mots.filter((m) => etatMot(m.boite) === etat);
}

export function compteursCarnet(mots: MotCarnetServi[]): Record<EtatMot, number> {
  const c: Record<EtatMot, number> = { a_revoir: 0, en_cours: 0, connu: 0 };
  for (const m of mots) c[etatMot(m.boite)]++;
  return c;
}

export const motsEchus = (mots: MotCarnetServi[], aujourdhui: Jour): MotCarnetServi[] => mots.filter((m) => m.prochaineRevue <= aujourdhui);

export type DonneesRevision = { exam: string; revision: Revision; carnet: MotCarnetServi[]; depuisCopie: boolean };

/** Notions, maîtrise et carnet de l'examen préparé : tout ce que Réviser, l'accueil et la carte affichent. */
export async function chargerDonneesRevision(): Promise<DonneesRevision> {
  const profil = await lireProfil();
  const exam = profil?.exam ?? 'toeic';
  const [r, c] = await Promise.all([chargerRevision(exam, jourDe(new Date())), chargerCarnet(exam)]);
  return { exam, revision: r.valeur, carnet: c.valeur, depuisCopie: r.depuisCopie || c.depuisCopie };
}
