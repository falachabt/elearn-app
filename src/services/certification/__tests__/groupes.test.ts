import { indicesGroupe, membresGroupe } from '../groupes';
import type { QuestionServie } from '../types';

const q = (id: string, groupe: string | null): QuestionServie => ({
  id,
  part: 3,
  type: 'question_reponse',
  number: null,
  stem: '',
  options: ['a', 'b', 'c', 'd'],
  group: groupe ? { id: groupe, audio_path: null, image_path: null, image_alt: null, passage: null } : null,
});

describe('membresGroupe : questions d’un même audio ou passage', () => {
  const liste = [q('q1', 'g1'), q('q2', 'g1'), q('q3', 'g1'), q('q4', 'g2'), q('q5', null)];

  it('rend toutes les questions consécutives du même groupe, à partir de l’index', () => {
    expect(membresGroupe(liste, 0).map((m) => m.id)).toEqual(['q1', 'q2', 'q3']);
    expect(membresGroupe(liste, 1).map((m) => m.id)).toEqual(['q2', 'q3']);
  });

  it('s’arrête au premier changement de groupe', () => {
    expect(membresGroupe(liste, 3).map((m) => m.id)).toEqual(['q4']);
  });

  it('une question sans groupe forme un groupe de une', () => {
    expect(membresGroupe(liste, 4).map((m) => m.id)).toEqual(['q5']);
  });

  it('renvoie une liste vide hors de la séance', () => {
    expect(membresGroupe(liste, 9)).toEqual([]);
  });
});

describe('indicesGroupe : tout le groupe, avant et après la question courante', () => {
  const liste = [q('q1', 'g1'), q('q2', 'g1'), q('q3', 'g1'), q('q4', 'g2'), q('q5', null)];

  it('inclut les questions déjà passées du groupe', () => {
    expect(indicesGroupe(liste, 1)).toEqual([0, 1, 2]);
    expect(indicesGroupe(liste, 2)).toEqual([0, 1, 2]);
  });

  it('ne déborde pas sur le groupe voisin', () => {
    expect(indicesGroupe(liste, 3)).toEqual([3]);
  });

  it('une question sans groupe forme un groupe de une', () => {
    expect(indicesGroupe(liste, 4)).toEqual([4]);
  });
});
