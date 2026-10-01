import AsyncStorage from '@react-native-async-storage/async-storage';

import { enregistrerScore, noterDernier } from '../entrainement';
import { lireReprise } from '../reprise';
import { noterDerniereLecon } from '../reviser';

const cours = [{ id: 1, nom: 'Fractions', matiere: 'Mathématiques', lecons: 2 }];
const copie = { quiz: [{ id: 'q1', nom: 'Quiz', questions: 5 }], exercices: [{ id: 'e1', titre: 'Simplifier', enonce: '' }, { id: 'e2', titre: 'Comparer', enonce: '' }] };

describe('lireReprise', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem('entrainement.cours.1', JSON.stringify(copie));
  });

  it('rien en cours : liste vide', async () => {
    expect(await lireReprise(cours)).toEqual([]);
  });

  it('leçon, quiz et exercice en cours, du plus récent au plus ancien, avec la matière', async () => {
    await noterDerniereLecon({ id: 11, cours: 1, nom: 'Définition', numero: 1, minutes: 8 }, 100);
    await noterDernier({ type: 'quiz', id: 'q1', cours: 1, chapitre: 'Fractions' }, 300);
    await noterDernier({ type: 'exercice', id: 'e2', cours: 1, chapitre: '' }, 200);
    const r = await lireReprise(cours);
    expect(r.map((e) => e.type)).toEqual(['quiz', 'exercice', 'lecon']);
    expect(r[0]).toMatchObject({ matiere: 'Mathématiques', chapitre: 'Fractions' });
    expect(r[1]).toMatchObject({ dernier: { rang: 2, total: 2 } });
  });

  it('ce qui est fini disparaît : leçon validée, quiz à 80 % ou plus', async () => {
    await noterDerniereLecon({ id: 11, cours: 1, nom: 'Définition', numero: 1, minutes: 8 }, 100);
    await AsyncStorage.setItem('reviser.lues', JSON.stringify({ 11: 1 }));
    await noterDernier({ type: 'quiz', id: 'q1', cours: 1, chapitre: 'Fractions' }, 300);
    await enregistrerScore('q1', 4, 5);
    expect(await lireReprise(cours)).toEqual([]);
  });
});
