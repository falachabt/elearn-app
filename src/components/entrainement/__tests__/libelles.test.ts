import { rangsSansNom } from '../libelles';

describe('rangsSansNom', () => {
  it('numérote les quiz sans nom seulement s’il y en a plusieurs', () => {
    const quiz = [
      { id: 'a', nom: 'Quiz' },
      { id: 'b', nom: 'Optique - Quiz' },
      { id: 'c', nom: 'Quiz 2/3: Lentilles' },
    ];
    expect(rangsSansNom(quiz, 'Optique')).toEqual({ a: 1, b: 2 });
    expect(rangsSansNom([quiz[0], quiz[2]], 'Optique')).toEqual({});
  });
});
