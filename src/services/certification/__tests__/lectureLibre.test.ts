import AsyncStorage from '@react-native-async-storage/async-storage';

import { allerALibre, estLecture, lireMini, nonRepondues, repondreLibre, reponseDe, terminerLibre, type EtatMini } from '../miniTest';

const q = (id: string, part: number, groupe?: string) =>
  ({ id, part, number: Number(id.slice(1)), group: groupe ? { id: groupe } : null, type: 'phrase' }) as never;

function etat(kind: 'full' | 'half_reading' | 'half_listening' = 'full'): EtatMini {
  return {
    clientUuid: 'c', exam: 'toeic', partie: null, longueur: 200, debutMs: Date.now(), dureeMin: 120,
    tentative: { attempt_id: 'a1', kind, questions: [q('q1', 4), q('q2', 5), q('q3', 6, 'g'), q('q4', 6, 'g'), q('q5', 7)] } as never,
    reponses: [], index: 1, termine: false, fin: null,
  };
}

beforeEach(() => AsyncStorage.clear());

describe('lecture en navigation libre', () => {
  it('seules les parties 5 à 7 d’un test complet ou d’une moitié lecture sont libres', () => {
    expect(estLecture(etat(), 0)).toBe(false);
    expect(estLecture(etat(), 1)).toBe(true);
    expect(estLecture(etat('half_reading'), 4)).toBe(true);
    expect(estLecture(etat('half_listening'), 1)).toBe(false);
  });

  it('une réponse se remplace sans doublon et la dernière fait foi', async () => {
    let e = await repondreLibre(etat(), 'q2', 0, 1000);
    e = await repondreLibre(e, 'q2', 2, 500);
    expect(e.reponses).toHaveLength(1);
    expect(reponseDe(e, 'q2')).toBe(2);
    expect((await lireMini())?.reponses).toHaveLength(1);
  });

  it('refuse de modifier une question d’écoute', async () => {
    const e = await repondreLibre(etat(), 'q1', 1, 100);
    expect(e.reponses).toHaveLength(0);
  });

  it('compte les questions sans réponse, une passée compte comme sans réponse', async () => {
    let e = etat();
    expect(nonRepondues(e)).toBe(4);
    e = await repondreLibre(e, 'q2', 1, 10);
    e = await repondreLibre(e, 'q3', null, 10);
    expect(nonRepondues(e)).toBe(3);
  });

  it('se place au début du groupe qui contient la question', async () => {
    const e = await allerALibre(etat(), 3);
    expect(e.index).toBe(2);
    expect((await allerALibre(e, 0)).index).toBe(2);
  });

  it('terminer garde les réponses et ne touche pas au serveur', async () => {
    let e = await repondreLibre(etat(), 'q5', 0, 10);
    e = await terminerLibre(e);
    expect(e.termine).toBe(true);
    expect(e.reponses).toHaveLength(1);
    expect(await repondreLibre(e, 'q2', 1, 10)).toBe(e);
  });
});
