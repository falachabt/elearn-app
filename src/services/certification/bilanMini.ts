import { scoreSection } from './certScore';
import { titreAffiche } from './titre';
import type { ResultatReponse } from './types';

export type NotionPerdue = { id: string; titre: string; manquees: number };

/** Les notions qui ont coûté le plus (E6) : questions fausses ou passées, regroupées par notion, trois au plus. */
export function notionsPerdues(resultats: ResultatReponse[], max = 3): NotionPerdue[] {
  const compte = new Map<string, NotionPerdue>();
  for (const r of resultats) {
    if (r.correct || !r.notion) continue;
    const entree = compte.get(r.notion.id) ?? { id: r.notion.id, titre: titreAffiche(r.notion.title), manquees: 0 };
    entree.manquees += 1;
    compte.set(r.notion.id, entree);
  }
  return [...compte.values()].sort((a, b) => b.manquees - a.manquees || a.titre.localeCompare(b.titre)).slice(0, max);
}

/**
 * Score de chaque section (v28 : Listening = P1 à P4, Reading = P5 à P7), sur 495, même formule que le serveur
 * (`scoreSection`). Une section sans réponse vaut 5, le plancher de la formule.
 */
export function scoresSections(perPart: Record<string, { answered: number; correct: number }>): { listening: number; reading: number } {
  const section = (de: number, a: number) => {
    let bonnes = 0;
    let repondues = 0;
    for (const [partie, p] of Object.entries(perPart)) {
      const n = Number(partie);
      if (n >= de && n <= a) {
        bonnes += p.correct;
        repondues += p.answered;
      }
    }
    return scoreSection(repondues === 0 ? 0 : bonnes / repondues);
  };
  return { listening: section(1, 4), reading: section(5, 7) };
}

/** Une ligne du bloc « Détail par partie » du bilan : la partie et ses bonnes réponses sur les répondues. */
export type LigneDetailPartie = { partie: number; correct: number; answered: number };

/**
 * Détail par partie d'une fin de test (`per_part` du serveur), trié par numéro de partie croissant. Seules les
 * parties du test sont présentes dans `per_part` : un demi-test ne donne que ses parties, un mini par partie la
 * sienne, un complet ou un mixte les sept.
 */
export function detailParPartie(perPart: Record<string, { answered: number; correct: number }>): LigneDetailPartie[] {
  return Object.entries(perPart)
    .map(([partie, p]) => ({ partie: Number(partie), correct: p.correct, answered: p.answered }))
    .filter((l) => Number.isInteger(l.partie) && l.partie >= 1 && l.partie <= 7)
    .sort((a, b) => a.partie - b.partie);
}

/** Statut d'une question d'un test terminé : juste, faux, ou sans réponse (passée ou absente des résultats). */
export type StatutQuestion = 'juste' | 'faux' | 'sans';

/** Statut de chaque question dans l'ordre servi. Une question sans réponse compte fausse (v28). */
export function statutsDesQuestions(ids: string[], resultats: ResultatReponse[]): StatutQuestion[] {
  const parId = new Map(resultats.map((r) => [r.question_id, r]));
  return ids.map((id): StatutQuestion => {
    const r = parId.get(id);
    if (!r || r.skipped) return 'sans';
    return r.correct ? 'juste' : 'faux';
  });
}
