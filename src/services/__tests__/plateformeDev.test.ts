let mockDev = true;
jest.mock('../developpement', () => ({ modeDeveloppement: () => mockDev }));

import { definirIosSimule, iosSimule } from '../plateformeDev';

describe('simulation iOS (page développeur)', () => {
  afterEach(() => {
    mockDev = true;
    definirIosSimule(false);
  });

  it('par défaut : aucune simulation', () => {
    expect(iosSimule()).toBe(false);
  });

  it('activable puis désactivable en mode développement', () => {
    definirIosSimule(true);
    expect(iosSimule()).toBe(true);
    definirIosSimule(false);
    expect(iosSimule()).toBe(false);
  });

  it('inactive (et non activable) hors mode développement', () => {
    mockDev = false;
    definirIosSimule(true);
    expect(iosSimule()).toBe(false);
  });
});
