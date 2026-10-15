import { ecartJours, type Jour } from './jours';
import type { Maitrise } from './certMaitrise';
import type { Reglages } from './reglages';

/** F7 : composition de la séance du jour. Quatre blocs dans un ordre fixe ; un bloc sans contenu est omis. */
export type NotionSeance = {
  id: string;
  ordre: number;
  maitrise: Maitrise;
  /** Jours des erreurs récentes (une entrée par réponse fausse). */
  erreurs: Jour[];
  derniereOuverture: Jour | null;
  titre: string;
};
export type PartieSeance = { partie: number; maitrise: Maitrise };

export type BlocSeance =
  | { type: 'cours'; notionId: string; minutes: number }
  | { type: 'mots'; nombre: number }
  | { type: 'rejeu'; nombre: number }
  | { type: 'serie'; partie: number; nombre: number };

export type Pourquoi =
  | { type: 'erreurs'; notion: string; erreurs: number; motsEchus: number }
  | { type: 'plan' };

export type Seance = { minutes: number; blocs: BlocSeance[]; pourquoi: Pourquoi };

export type EntreeSeance = {
  minutes: number;
  aujourdhui: Jour;
  notions: NotionSeance[];
  partiesMaitrise: PartieSeance[];
  partieVeille: number | null;
  motsEchus: number;
  rejeuxEchus: number;
};

type Parametres = Pick<Reglages, 'budgetSeance' | 'joursRecents' | 'refroidissementNotionJours'>;

/** Notion de cours : la plus basse maîtrise parmi celles qui ont une erreur récente et une fiche non ouverte depuis le refroidissement. */
export function choisirNotion(notions: NotionSeance[], aujourdhui: Jour, r: Parametres): { notion: NotionSeance; erreursRecentes: number } | null {
  const recentes = (n: NotionSeance) => n.erreurs.filter((j) => ecartJours(j, aujourdhui) <= r.joursRecents).length;
  const reposee = (n: NotionSeance) => n.derniereOuverture === null || ecartJours(n.derniereOuverture, aujourdhui) >= r.refroidissementNotionJours;
  const candidates = notions.filter((n) => recentes(n) > 0 && reposee(n));
  if (candidates.length > 0) {
    candidates.sort((a, b) => (a.maitrise.m ?? 0) - (b.maitrise.m ?? 0) || recentes(b) - recentes(a) || a.ordre - b.ordre);
    return { notion: candidates[0], erreursRecentes: recentes(candidates[0]) };
  }
  const neuve = [...notions].filter((n) => n.maitrise.etat === 'pas_commencee').sort((a, b) => a.ordre - b.ordre)[0];
  return neuve ? { notion: neuve, erreursRecentes: 0 } : null;
}

/** Partie de plus faible maîtrise, différente de celle de la veille si possible. */
export function choisirPartie(parties: PartieSeance[], partieVeille: number | null): number | null {
  if (parties.length === 0) return null;
  const tri = (liste: PartieSeance[]) => [...liste].sort((a, b) => (a.maitrise.m ?? -1) - (b.maitrise.m ?? -1) || a.partie - b.partie)[0].partie;
  const autres = parties.filter((p) => p.partie !== partieVeille);
  return tri(autres.length > 0 ? autres : parties);
}

export function composerSeance(e: EntreeSeance, r: Parametres): Seance | null {
  const budget = r.budgetSeance[String(e.minutes)];
  if (!budget) throw new Error(`Durée de séance sans budget : ${e.minutes}`);
  const blocs: BlocSeance[] = [];
  const choix = choisirNotion(e.notions, e.aujourdhui, r);
  if (choix) blocs.push({ type: 'cours', notionId: choix.notion.id, minutes: budget.notionMin });
  const mots = Math.min(budget.mots, e.motsEchus);
  if (mots > 0) blocs.push({ type: 'mots', nombre: mots });
  const rejeu = Math.min(budget.rejeu, e.rejeuxEchus);
  if (rejeu > 0) blocs.push({ type: 'rejeu', nombre: rejeu });
  const partie = choisirPartie(e.partiesMaitrise, e.partieVeille);
  if (partie !== null) blocs.push({ type: 'serie', partie, nombre: budget.serie });
  if (blocs.length === 0) return null;
  const pourquoi: Pourquoi =
    choix && choix.erreursRecentes > 0
      ? { type: 'erreurs', notion: choix.notion.titre, erreurs: choix.erreursRecentes, motsEchus: e.motsEchus }
      : { type: 'plan' };
  return { minutes: e.minutes, blocs, pourquoi };
}
