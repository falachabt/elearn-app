let mockDev = true;
jest.mock('../developpement', () => ({ modeDeveloppement: () => mockDev }));

import { ajusterSoldeSimule, definirSoldeSimule, ecouterSoldeSimule, soldeSimule } from '../creditsDev';

beforeEach(() => {
  mockDev = true;
  definirSoldeSimule(null);
});

describe('solde de crédits simulé (page développeur)', () => {
  it('par défaut : aucune simulation, le solde réel s’applique', () => {
    expect(soldeSimule()).toBeNull();
  });

  it('vider, retirer et ajouter, sans jamais passer sous zéro', () => {
    definirSoldeSimule(0);
    expect(soldeSimule()).toBe(0);
    ajusterSoldeSimule(5, 18);
    expect(soldeSimule()).toBe(5);
    ajusterSoldeSimule(-5, 18);
    ajusterSoldeSimule(-5, 18);
    expect(soldeSimule()).toBe(0);
  });

  it('première modification : part du solde réel donné', () => {
    ajusterSoldeSimule(-5, 18);
    expect(soldeSimule()).toBe(13);
  });

  it('revenir au solde réel', () => {
    definirSoldeSimule(3);
    definirSoldeSimule(null);
    expect(soldeSimule()).toBeNull();
  });

  it('les abonnés sont prévenus à chaque changement', () => {
    const ecouteur = jest.fn();
    const arreter = ecouterSoldeSimule(ecouteur);
    definirSoldeSimule(2);
    ajusterSoldeSimule(5, 0);
    arreter();
    definirSoldeSimule(9);
    expect(ecouteur).toHaveBeenCalledTimes(2);
  });

  it('jamais actif en production', () => {
    definirSoldeSimule(4);
    mockDev = false;
    expect(soldeSimule()).toBeNull();
    definirSoldeSimule(7);
    mockDev = true;
    expect(soldeSimule()).toBe(4);
  });
});
