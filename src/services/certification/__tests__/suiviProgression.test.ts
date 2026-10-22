import { progressionDemi } from '../suivi';
import type { ProgressionTest } from '../types';

const vide = (kind: ProgressionTest['kind']): ProgressionTest => ({ kind, statut: 'pas_fait', tentatives: 0, dernierScore: null, meilleurScore: null, derniereDate: null, tentativeEnCours: false });

describe('progressionDemi', () => {
  it('prend la moitié en cours avant tout', () => {
    const liste = [{ ...vide('half_listening'), statut: 'fait' as const, derniereDate: '2026-10-20' }, { ...vide('half_reading'), statut: 'en_cours' as const }];
    expect(progressionDemi(liste)?.kind).toBe('half_reading');
  });

  it('sinon prend la moitié faite la plus récente', () => {
    const liste = [{ ...vide('half_listening'), statut: 'fait' as const, derniereDate: '2026-10-10' }, { ...vide('half_reading'), statut: 'fait' as const, derniereDate: '2026-10-18' }];
    expect(progressionDemi(liste)?.kind).toBe('half_reading');
  });

  it("sans test fait, renvoie l'écoute ; ignore le test complet", () => {
    expect(progressionDemi([vide('full'), vide('half_listening'), vide('half_reading')])?.kind).toBe('half_listening');
  });
});
