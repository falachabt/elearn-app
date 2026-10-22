import { meilleurScore, tentativesDeType } from '../suivi';
import type { TentativeListee } from '../types';

const T = (surcharge: Partial<TentativeListee>): TentativeListee => ({
  id: 'x', kind: 'half_reading', part: null, length: 100, status: 'finished', score: 385, scoreMin: null, scoreMax: null,
  startedAt: '2026-10-18T10:00:00Z', finishedAt: '2026-10-18T11:00:00Z', perPart: null, timePerPart: null, creditsSpent: 8, refunded: false, questions: [], ...surcharge,
});

describe('tentativesDeType', () => {
  it('garde les moitiés pour un demi-test, le complet seul pour le complet, la plus récente d’abord', () => {
    const liste = [T({ id: 'a', startedAt: '2026-10-10T10:00:00Z' }), T({ id: 'b', kind: 'full', startedAt: '2026-10-12T10:00:00Z' }), T({ id: 'c', kind: 'half_listening', startedAt: '2026-10-15T10:00:00Z' })];
    expect(tentativesDeType(liste, 'half').map((t) => t.id)).toEqual(['c', 'a']);
    expect(tentativesDeType(liste, 'full').map((t) => t.id)).toEqual(['b']);
  });
});

describe('meilleurScore', () => {
  it('ignore les tentatives interrompues', () => {
    const liste = [T({ id: 'a', score: 705 }), T({ id: 'b', status: 'abandoned', score: 800 })];
    expect(meilleurScore(liste)).toBe(705);
  });

  it('vaut null sans tentative terminée', () => {
    expect(meilleurScore([T({ status: 'abandoned', score: 800 })])).toBeNull();
  });
});
