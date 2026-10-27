import { detailParPartie, scoresSections, statutsDesQuestions } from '../bilanMini';
import type { ResultatReponse } from '../types';

const resultat = (question_id: string, correct: boolean, skipped = false): ResultatReponse => ({
  question_id, client_uuid: question_id, correct, skipped, correct_index: 0, trap: null, notion: null, notions: [], transcript: null, replay: false,
});

describe('statutsDesQuestions', () => {
  it('juste, faux, ou sans réponse ; une question absente des résultats compte sans réponse', () => {
    const statuts = statutsDesQuestions(['a', 'b', 'c', 'd'], [resultat('a', true), resultat('b', false), resultat('c', false, true)]);
    expect(statuts).toEqual(['juste', 'faux', 'sans', 'sans']);
  });
});

describe('detailParPartie', () => {
  it('trie les parties par numéro croissant, bonnes sur répondues', () => {
    const perPart = { '7': { answered: 54, correct: 38 }, '5': { answered: 30, correct: 22 }, '6': { answered: 16, correct: 9 } };
    expect(detailParPartie(perPart)).toEqual([
      { partie: 5, correct: 22, answered: 30 },
      { partie: 6, correct: 9, answered: 16 },
      { partie: 7, correct: 38, answered: 54 },
    ]);
  });

  it('une seule ligne pour un mini par partie ; rien sans donnée', () => {
    expect(detailParPartie({ '6': { answered: 12, correct: 9 } })).toEqual([{ partie: 6, correct: 9, answered: 12 }]);
    expect(detailParPartie({})).toEqual([]);
  });
});

describe('scoresSections', () => {
  it('Listening = parties 1 à 4, Reading = parties 5 à 7, sur 495 par la formule du serveur', () => {
    const perPart = { '1': { answered: 4, correct: 4 }, '4': { answered: 0, correct: 0 }, '5': { answered: 4, correct: 0 }, '7': { answered: 2, correct: 1 } };
    expect(scoresSections(perPart)).toEqual({ listening: 495, reading: 85 });
  });

  it('une section sans réponse vaut le plancher 5', () => {
    expect(scoresSections({})).toEqual({ listening: 5, reading: 5 });
  });
});
