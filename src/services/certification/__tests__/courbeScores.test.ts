import { pointsCourbe } from '../suivi';
import type { TentativeListee } from '../types';

const T = (surcharge: Partial<TentativeListee>): TentativeListee => ({
  id: 'x', kind: 'half_reading', part: null, length: 100, status: 'finished', score: 385, scoreMin: null, scoreMax: null,
  startedAt: '2026-10-18T10:00:00Z', finishedAt: '2026-10-18T11:00:00Z', perPart: null, timePerPart: null, creditsSpent: 8, refunded: false, questions: [], ...surcharge,
});

describe('pointsCourbe', () => {
  it('sans diagnostic ni test : seulement le départ à 0', () => {
    expect(pointsCourbe([])).toEqual([{ type: 'depart' }]);
  });

  it('diagnostic seul : départ puis le score du diagnostic', () => {
    const liste = [T({ kind: 'diagnostic', score: 745, finishedAt: '2026-10-10T11:00:00Z' })];
    expect(pointsCourbe(liste)).toEqual([{ type: 'depart' }, { type: 'diagnostic', valeur: 745 }]);
  });

  it('un point par demi-test ou test complet terminé, dans l’ordre de fin ; mini-tests et interrompues exclus', () => {
    const liste = [
      T({ id: 'a', kind: 'full', score: 610, finishedAt: '2026-10-19T11:00:00Z' }),
      T({ id: 'b', kind: 'half_reading', score: 385, finishedAt: '2026-10-18T11:00:00Z' }),
      T({ id: 'c', kind: 'half_listening', score: 800, status: 'abandoned', finishedAt: null }),
      T({ id: 'd', kind: 'mini', score: null, finishedAt: '2026-10-17T11:00:00Z' }),
    ];
    expect(pointsCourbe(liste)).toEqual([
      { type: 'depart' },
      { type: 'test', valeur: 385, numero: 1 },
      { type: 'test', valeur: 610, numero: 2 },
    ]);
  });
});
