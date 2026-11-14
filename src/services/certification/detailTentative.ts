import AsyncStorage from '@react-native-async-storage/async-storage';

import { titreAffiche } from './titre';
import type { QuestionServie, ResultatReponse } from './types';

/** Une notion touchée par la tentative : bonnes réponses sur le nombre de questions qui la portent. */
export type NotionTentative = { id: string; titre: string; bonnes: number; total: number };
/** Une question ratée (fausse ou sans réponse) : sa position dans le test, sa notion principale. */
export type QuestionRatee = { id: string; position: number; part: number; notionId: string | null; notionTitre: string | null; sansReponse: boolean };
/** Détail d'une tentative terminée (maquette T7) : « Par notion » et « Questions ratées ». */
export type DetailDeTentative = { notions: NotionTentative[]; ratees: QuestionRatee[] };

const cle = (id: string) => `cert.tentative.detail.${id}`;

/** Regroupe les résultats par notion principale et liste les questions ratées, dans l'ordre du test. */
export function construireDetail(questions: Pick<QuestionServie, 'id' | 'part'>[], resultats: ResultatReponse[]): DetailDeTentative {
  const parQuestion = new Map(resultats.map((r) => [r.question_id, r]));
  const notions = new Map<string, NotionTentative>();
  const ratees: QuestionRatee[] = [];
  questions.forEach((q, i) => {
    const r = parQuestion.get(q.id);
    if (!r) return;
    if (r.notion) {
      const n = notions.get(r.notion.id) ?? { id: r.notion.id, titre: titreAffiche(r.notion.title), bonnes: 0, total: 0 };
      n.total += 1;
      if (r.correct) n.bonnes += 1;
      notions.set(r.notion.id, n);
    }
    if (!r.correct) ratees.push({ id: q.id, position: i + 1, part: q.part, notionId: r.notion?.id ?? null, notionTitre: r.notion ? titreAffiche(r.notion.title) : null, sansReponse: r.skipped });
  });
  // Les notions les plus fragiles d'abord, puis par nom : l'élève voit ce qui reste à travailler en tête.
  const liste = [...notions.values()].sort((a, b) => a.bonnes / a.total - b.bonnes / b.total || a.titre.localeCompare(b.titre));
  return { notions: liste, ratees };
}

/** Garde le détail sur l'appareil au moment du bilan : le serveur ne le rend pas pour une tentative passée. */
export async function enregistrerDetail(tentativeId: string, detail: DetailDeTentative): Promise<void> {
  try {
    await AsyncStorage.setItem(cle(tentativeId), JSON.stringify(detail));
  } catch {
    // Le détail est un confort : sans stockage, la page de la tentative garde son affichage par partie.
  }
}

/** Détail gardé pour cette tentative, ou `null` (autre appareil, test passé avant cette version). */
export async function lireDetail(tentativeId: string): Promise<DetailDeTentative | null> {
  try {
    const brut = await AsyncStorage.getItem(cle(tentativeId));
    if (!brut) return null;
    const d = JSON.parse(brut) as DetailDeTentative;
    return Array.isArray(d.notions) && Array.isArray(d.ratees) ? d : null;
  } catch {
    return null;
  }
}
