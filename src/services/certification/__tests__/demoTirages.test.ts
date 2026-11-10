import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiDemo } from '../demo/apiDemo';
import contenu from '../demo/contenu.json';
import type { QuestionServie } from '../types';

let compteur = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++compteur).padStart(12, '0')}`;

/** Nombre de questions de chaque groupe dans la banque de démo. */
const tailleGroupe = new Map<string, number>();
for (const q of contenu.questions) {
  if (q.group) tailleGroupe.set(q.group, (tailleGroupe.get(q.group) ?? 0) + 1);
}

/** Un tirage ne sert jamais un groupe à moitié : chaque groupe présent l'est avec toutes ses questions. */
function verifierGroupesEntiers(questions: QuestionServie[]) {
  const servis = new Map<string, number>();
  for (const q of questions) {
    if (q.group) servis.set(q.group.id, (servis.get(q.group.id) ?? 0) + 1);
  }
  for (const [id, n] of servis) expect(n).toBe(tailleGroupe.get(id));
}

const parPartie = (questions: QuestionServie[]) => {
  const comptes: Record<number, number> = {};
  for (const q of questions) comptes[q.part] = (comptes[q.part] ?? 0) + 1;
  return comptes;
};

beforeEach(async () => {
  compteur = 0;
  await AsyncStorage.clear();
});

// I-5 de l'audit de cohérence du 25 octobre 2026 : la démo suit le plan mixte du serveur et tire par groupes entiers.
describe('démo web — tirages alignés sur le serveur', () => {
  it('mini mixte de 20 : répartition mini_mixed_counts {2,2,3,3,2,4,4}, groupes entiers', async () => {
    const r = await apiDemo.demarrerMini(uuid(), 'toeic', null, 20, '2030-06-01');
    if (!r.tentative) throw new Error('départ attendu');
    expect(r.tentative.questions).toHaveLength(20);
    expect(parPartie(r.tentative.questions)).toEqual({ 1: 2, 2: 2, 3: 3, 4: 3, 5: 2, 6: 4, 7: 4 });
    verifierGroupesEntiers(r.tentative.questions);
  });

  it('mini mixte de 10 : total tenu (appoint en unités entières), groupes entiers', async () => {
    const r = await apiDemo.demarrerMini(uuid(), 'toeic', null, 10, '2030-06-01');
    if (!r.tentative) throw new Error('départ attendu');
    expect(r.tentative.questions).toHaveLength(10);
    verifierGroupesEntiers(r.tentative.questions);
  });

  it('mini de partie 6 au palier de base : 12 questions en groupes entiers', async () => {
    const r = await apiDemo.demarrerMini(uuid(), 'toeic', 6, 10, '2030-06-01');
    if (!r.tentative) throw new Error('départ attendu');
    expect(r.tentative.questions).toHaveLength(12);
    verifierGroupesEntiers(r.tentative.questions);
  });

  it('mini de partie 3 au palier de base : 12 questions en groupes entiers', async () => {
    const r = await apiDemo.demarrerMini(uuid(), 'toeic', 3, 10, '2030-06-01');
    if (!r.tentative) throw new Error('départ attendu');
    expect(r.tentative.questions).toHaveLength(12);
    verifierGroupesEntiers(r.tentative.questions);
  });

  it('série de partie 6 : groupes entiers — 8 servies pour 10 demandées (groupes de 4)', async () => {
    const questions = await apiDemo.lireSerie({ part: 6 }, 'toeic', 10);
    expect(questions).toHaveLength(8);
    verifierGroupesEntiers(questions);
  });

  it('série mixte : 10 servies, groupes entiers', async () => {
    const questions = await apiDemo.lireSerie({}, 'toeic', 10);
    expect(questions).toHaveLength(10);
    verifierGroupesEntiers(questions);
  });
});
