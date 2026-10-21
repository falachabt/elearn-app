import AsyncStorage from '@react-native-async-storage/async-storage';

import { enregistrerCorrection, oublierCorrectionEnMemoire } from '../correction';
import { CLE_ERREURS_SEMAINE, JOURS_CONSERVES, MAX_ERREURS_JOURNAL, lireErreursSemaine, noterCorrection } from '../erreursSemaine';
import type { QuestionTiree } from '../miniTest';

const q = (id: string): QuestionTiree => ({ id, matiere: 'maths', libelleMatiere: null, chapitre: 'C', cours: null, enonce: `Q${id}`, choix: ['A', 'B', 'C'], bonne: 1 } as QuestionTiree);
// Mercredi 7 octobre 2026 : la semaine commence le lundi 5.
const MERCREDI = new Date(2026, 9, 7, 10);
const LUNDI = '2026-10-05';

beforeEach(async () => {
  await AsyncStorage.clear();
  oublierCorrectionEnMemoire();
});

describe('journal des erreurs de la semaine', () => {
  it('garde les questions ratées ou passées, pas les justes', async () => {
    await noterCorrection({ questions: [q('1'), q('2'), q('3')], reponses: [0, 1, null] }, MERCREDI);
    const liste = await lireErreursSemaine(LUNDI);
    expect(liste.map((e) => e.question.id).sort()).toEqual(['1', '3']);
    expect(liste.every((e) => e.jour === '2026-10-07')).toBe(true);
  });

  it('une erreur refaite juste sort du journal ; une erreur encore ratée garde son jour d’origine', async () => {
    await noterCorrection({ questions: [q('1'), q('2')], reponses: [0, 0] }, MERCREDI);
    await noterCorrection({ questions: [q('1'), q('2')], reponses: [1, 2] }, new Date(2026, 9, 9, 9));
    const liste = await lireErreursSemaine(LUNDI);
    expect(liste.map((e) => e.question.id)).toEqual(['2']);
    expect(liste[0].jour).toBe('2026-10-07');
  });

  it('classe par semaine : lundi et dimanche inclus, semaines voisines exclues', async () => {
    await noterCorrection({ questions: [q('lun')], reponses: [0] }, new Date(2026, 9, 5, 8));
    await noterCorrection({ questions: [q('dim')], reponses: [0] }, new Date(2026, 9, 11, 22));
    await noterCorrection({ questions: [q('suivante')], reponses: [0] }, new Date(2026, 9, 12, 8));
    await noterCorrection({ questions: [q('avant')], reponses: [0] }, new Date(2026, 9, 4, 22));
    expect((await lireErreursSemaine(LUNDI)).map((e) => e.question.id).sort()).toEqual(['dim', 'lun']);
  });

  it('oublie les erreurs trop anciennes et plafonne la taille du journal', async () => {
    const vieux = new Date(MERCREDI);
    vieux.setDate(vieux.getDate() - JOURS_CONSERVES - 3);
    await noterCorrection({ questions: [q('vieille')], reponses: [0] }, vieux);
    const nombreuses = Array.from({ length: MAX_ERREURS_JOURNAL + 20 }, (_, i) => q(`n${i}`));
    await noterCorrection({ questions: nombreuses, reponses: nombreuses.map(() => 0) }, MERCREDI);
    const brut = JSON.parse((await AsyncStorage.getItem(CLE_ERREURS_SEMAINE)) ?? '[]');
    expect(brut).toHaveLength(MAX_ERREURS_JOURNAL);
    expect(brut.some((e: { question: { id: string } }) => e.question.id === 'vieille')).toBe(false);
  });

  it('un journal illisible donne une liste vide au lieu de planter', async () => {
    await AsyncStorage.setItem(CLE_ERREURS_SEMAINE, '{pas du json');
    expect(await lireErreursSemaine(LUNDI)).toEqual([]);
    await AsyncStorage.setItem(CLE_ERREURS_SEMAINE, JSON.stringify({ non: 'liste' }));
    expect(await lireErreursSemaine(LUNDI)).toEqual([]);
  });

  it('enregistrerCorrection alimente le journal (quiz terminé)', async () => {
    await enregistrerCorrection({ source: 'libre', questions: [q('x'), q('y')], reponses: [0, 1] });
    const aujourdhui = new Date();
    const lundi = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - ((aujourdhui.getDay() + 6) % 7));
    const txt = `${lundi.getFullYear()}-${String(lundi.getMonth() + 1).padStart(2, '0')}-${String(lundi.getDate()).padStart(2, '0')}`;
    expect((await lireErreursSemaine(txt)).map((e) => e.question.id)).toEqual(['x']);
  });
});
