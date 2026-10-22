import AsyncStorage from '@react-native-async-storage/async-storage';

import { definirApi } from '../api';
import { apiDemo } from '../demo/apiDemo';
import { dureeTestMin, etatDeReprise, lancerTest, lireMini } from '../miniTest';
import { lireReglages } from '../reglages';
import { LIGNES_SEED } from './fixtures';

let mockCompteur = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-4000-8000-${String(++mockCompteur).padStart(12, '0')}` }));

const r = lireReglages(LIGNES_SEED);

beforeEach(async () => {
  mockCompteur = 0;
  await AsyncStorage.clear();
  definirApi(apiDemo);
});
afterEach(() => definirApi(null));

// Lancement d'un demi-test ou du test complet : même état local que le mini-test, avec la durée officielle.
describe('lancement des demi-tests et du test complet', () => {
  it('la durée officielle : 45 min en écoute, 75 min en lecture, 120 min pour le complet', () => {
    expect(dureeTestMin).toEqual({ half_listening: 45, half_reading: 75, full: 120 });
  });

  it('demi-test écoute : 100 questions, 45 minutes, stocké sur l’appareil', async () => {
    const res = await lancerTest('toeic', 'demo-test', 'half_listening');
    expect(res.statut).toBe('demarre');
    if (res.statut !== 'demarre') return;
    expect(res.etat.longueur).toBe(100);
    expect(res.etat.dureeMin).toBe(45);
    expect(res.etat.tentative.questions).toHaveLength(100);
    expect((await lireMini())?.longueur).toBe(100);
  });

  it('test complet : 200 questions, 120 minutes', async () => {
    const res = await lancerTest('toeic', 'demo-test', 'full');
    if (res.statut !== 'demarre') throw new Error('départ attendu');
    expect(res.etat.longueur).toBe(200);
    expect(res.etat.dureeMin).toBe(120);
  });

  it('reprise : après 10 min, le test est en cours ; après la durée, il est à rendre ou périmé', async () => {
    const res = await lancerTest('toeic', 'demo-test', 'half_reading');
    if (res.statut !== 'demarre') throw new Error('départ attendu');
    const { etat } = res;
    expect(etatDeReprise(etat, r, etat.debutMs + 10 * 60_000)).toBe('en_cours');
    expect(etatDeReprise(etat, r, etat.debutMs + 80 * 60_000)).not.toBe('en_cours');
  });
});
