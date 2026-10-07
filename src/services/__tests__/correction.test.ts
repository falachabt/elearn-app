import AsyncStorage from '@react-native-async-storage/async-storage';

import { enregistrerCorrection, lireCorrection, statuts, type Correction } from '../correction';

const q = (id: string, bonne: number) => ({ id, enonce: `Q${id}`, options: ['a', 'b', 'c'], bonne, matiere: 'Maths' }) as never;
const quiz: Correction = { source: 'lecon', questions: [q('1', 0), q('2', 1), q('3', 2)], reponses: [0, 0, 0], contexte: { type: 'lecon', lecon: 5, cours: 2 } };

beforeEach(() => AsyncStorage.clear());

describe('dernière correction (Refaire mes erreurs, Revoir la correction)', () => {
  it('relue telle quelle, avec ses deux erreurs', async () => {
    await enregistrerCorrection(quiz);
    const c = await lireCorrection();
    expect(statuts(c as Correction)).toEqual(['juste', 'faux', 'faux']);
  });

  it('écriture refusée par le stockage (plein) : le quiz qui vient d’être fini reste lisible pendant la session', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('database or disk is full'));
    await enregistrerCorrection(quiz);
    expect(statuts((await lireCorrection()) as Correction)).toEqual(['juste', 'faux', 'faux']);
  });

  it('quiz fini pendant la session : lu sans passer par le stockage (ligne trop grosse ou illisible), jamais « rien à regarder »', async () => {
    await enregistrerCorrection(quiz);
    const lire = jest.spyOn(AsyncStorage, 'getItem');
    lire.mockClear();
    expect((await lireCorrection())?.questions).toHaveLength(3);
    expect(lire).not.toHaveBeenCalled();
  });

  it('une correction plus récente remplace la précédente (même quand l’ancienne est encore dans le stockage)', async () => {
    await enregistrerCorrection(quiz);
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
    await enregistrerCorrection({ ...quiz, reponses: [0, 1, 2] });
    expect(statuts((await lireCorrection()) as Correction)).toEqual(['juste', 'juste', 'juste']);
  });

  it('au démarrage, sans quiz fini : la copie du stockage', async () => {
    await AsyncStorage.setItem('quiz.correction', JSON.stringify(quiz));
    expect((await lireCorrection())?.questions).toHaveLength(3);
  });

  it('rien du tout : null', async () => {
    expect(await lireCorrection()).toBeNull();
  });
});
