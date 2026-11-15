import { ecrireJson, lireJson } from './etat';
import { jourDe, type Jour } from './jours';
import type { EtapePlan, PlanFrise } from './planFrise';

/**
 * Étapes du plan du jour faites sur cet appareil (retouche TOEIC de novembre 2026).
 *
 * Avant, rien n'écrivait qu'une étape était faite : le repli local recalculait la journée depuis le carnet et les notions,
 * donc une séance de mots terminée faisait DISPARAÎTRE l'étape (plus aucun mot à revoir) au lieu de la marquer « Fait ».
 * Maintenant : (1) l'écran de fin d'une séance écrit la clé de l'étape dans ce journal ; (2) le plan du jour (repli local)
 * est figé pour la journée, donc l'étape reste dans la frise ; (3) la frise applique le journal et affiche « Fait ».
 */
export const CLE_PLAN_FAITES = 'cert.planFaites';
export const CLE_PLAN_JOUR = 'cert.planJour';

type Faites = { jour: Jour; cles: string[] };
type PlanDuJour = { jour: Jour; exam: string; cles: string[]; local: EtapePlan[] | null };

/** Clé stable d'une étape : la même pour l'écran de fin qui la valide et pour la frise qui l'affiche. */
export function cleEtape(e: Pick<EtapePlan, 'type' | 'uniteKind' | 'uniteId'>): string {
  if (e.type === 'mini_test') return 'mini';
  if (e.type === 'test_complet') return 'test';
  if (e.uniteKind === 'words' || e.uniteKind === 'word_list' || e.uniteKind === 'vocabulary') return 'mots';
  if (e.uniteKind === 'part' && e.uniteId) return `partie:${e.uniteId}`;
  if (e.uniteKind === 'replay' || (e.type === 'rappel' && !e.uniteId)) return 'rejeu';
  if (e.uniteId) return e.type === 'pratique' ? `serie:${e.uniteId}` : `fiche:${e.uniteId}`;
  return 'seance';
}

export const cleSerie = (p: { part?: number | null; notion?: string | null; rejeu?: boolean }): string | null =>
  p.rejeu ? 'rejeu' : p.notion ? `serie:${p.notion}` : p.part ? `partie:${p.part}` : null;

async function lireFaites(jour: Jour): Promise<string[]> {
  const f = await lireJson<Faites>(CLE_PLAN_FAITES);
  return f && f.jour === jour ? f.cles : [];
}

/** Note qu'une étape d'aujourd'hui est faite (idempotent). Ne lève jamais : un échec d'écriture ne bloque pas la fin de séance. */
export async function marquerEtapeFaite(cle: string | null, jour: Jour = jourDe(new Date())): Promise<void> {
  if (!cle) return;
  try {
    const cles = await lireFaites(jour);
    if (!cles.includes(cle)) await ecrireJson(CLE_PLAN_FAITES, { jour, cles: [...cles, cle] } satisfies Faites);
  } catch {
    // jamais bloquant
  }
}

/** Vrai si l'étape fait partie du plan du jour montré à l'élève : l'écran de fin peut alors dire qu'elle y est validée. */
export async function etapeDansPlanDuJour(cle: string | null, jour: Jour = jourDe(new Date())): Promise<boolean> {
  if (!cle) return false;
  const p = await lireJson<PlanDuJour>(CLE_PLAN_JOUR).catch(() => null);
  return !!p && p.jour === jour && p.cles.includes(cle);
}

/**
 * Applique le journal au plan : les étapes d'aujourd'hui faites passent à « fait » (jour de réalisation = aujourd'hui).
 * Le plan du serveur garde son propre état `fait` ; le journal ne fait que l'ajouter.
 */
export function appliquerFaites(plan: PlanFrise, aujourdhui: Jour, faites: string[]): PlanFrise {
  if (faites.length === 0) return plan;
  return {
    ...plan,
    jours: plan.jours.map((j) =>
      j.jour !== aujourdhui
        ? j
        : { ...j, etapes: j.etapes.map((e) => (e.etat !== 'fait' && faites.includes(cleEtape(e)) ? { ...e, etat: 'fait' as const, faitLe: aujourdhui } : e)) },
    ),
  };
}

/**
 * Plan affiché : fige le repli local pour la journée (la frise ne change plus quand le carnet ou les notions bougent),
 * mémorise les clés d'aujourd'hui, puis applique le journal des étapes faites.
 */
export async function planAvecEtapesFaites(plan: PlanFrise, exam: string, aujourdhui: Jour): Promise<PlanFrise> {
  let courant = plan;
  try {
    const gele = await lireJson<PlanDuJour>(CLE_PLAN_JOUR);
    if (plan.local) {
      if (gele && gele.jour === aujourdhui && gele.exam === exam && gele.local && gele.local.length > 0) {
        courant = { ...plan, jours: plan.jours.map((j) => (j.jour === aujourdhui ? { ...j, etapes: gele.local!, minutes: gele.local!.reduce((s, e) => s + (e.minutes ?? 0), 0) } : j)) };
      }
    }
    const duJour = courant.jours.find((j) => j.jour === aujourdhui)?.etapes ?? [];
    const cles = duJour.map(cleEtape);
    const local = plan.local && duJour.length > 0 ? duJour : null;
    // Écrit seulement ce qui change : la frise se recharge souvent.
    if (!gele || gele.jour !== aujourdhui || gele.exam !== exam || gele.cles.join() !== cles.join() || (local && !gele.local)) {
      await ecrireJson(CLE_PLAN_JOUR, { jour: aujourdhui, exam, cles, local } satisfies PlanDuJour);
    }
    return appliquerFaites(courant, aujourdhui, await lireFaites(aujourdhui));
  } catch {
    return courant;
  }
}
