import type { ResultatReponse } from './types';

export type NotionPerdue = { id: string; titre: string; manquees: number };

/** Les notions qui ont coûté le plus (E6) : questions fausses ou passées, regroupées par notion, trois au plus. */
export function notionsPerdues(resultats: ResultatReponse[], max = 3): NotionPerdue[] {
  const compte = new Map<string, NotionPerdue>();
  for (const r of resultats) {
    if (r.correct || !r.notion) continue;
    const entree = compte.get(r.notion.id) ?? { id: r.notion.id, titre: r.notion.title, manquees: 0 };
    entree.manquees += 1;
    compte.set(r.notion.id, entree);
  }
  return [...compte.values()].sort((a, b) => b.manquees - a.manquees || a.titre.localeCompare(b.titre)).slice(0, max);
}
