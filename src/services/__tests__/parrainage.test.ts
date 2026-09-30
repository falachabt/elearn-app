import AsyncStorage from '@react-native-async-storage/async-storage';

import { suivre } from '../analytics';
import {
  CLE_PARRAINAGE,
  DUREE_CONSERVATION_MS,
  capturerDepuisUrl,
  conserverCode,
  effacerCode,
  extraireCodeDepuisUrl,
  lireCodeValide,
  normaliserCode,
} from '../parrainage';

jest.mock('../analytics', () => ({ suivre: jest.fn() }));

const T0 = 1_800_000_000_000;
const JOUR = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('normaliserCode', () => {
  it.each([
    ['abc123', 'ABC123'],
    ['  ab-cd 12 ', 'ABCD12'],
    ['ABCD', 'ABCD'],
  ])('%j -> %j', (brut, attendu) => expect(normaliserCode(brut)).toBe(attendu));

  it.each([[''], ['ABC'], ['TROPLONGCODE123'], ['ab;cd'], [null], [undefined]])('refuse %j', (brut) => expect(normaliserCode(brut)).toBeNull());
});

describe('extraireCodeDepuisUrl', () => {
  it.each([
    ['elearnprepa://rejoindre/amina24', 'AMINA24'],
    ['elearnprepa://rejoindre/AMINA24?utm=x', 'AMINA24'],
    ['https://elearnprepa.com/rejoindre/amina24', 'AMINA24'],
    ['https://elearnprepa.com/?ref=bob77', 'BOB77'],
    ['elearnprepa://moi?x=1&ref=zed99#haut', 'ZED99'],
  ])('%s -> %s', (url, attendu) => expect(extraireCodeDepuisUrl(url)).toBe(attendu));

  it.each([[null], [''], ['elearnprepa://moi'], ['elearnprepa://rejoindre/a'], ['https://x.com/?ref=%E0%A4%A'], ['https://x.com/?ref=a b']])('ignore %j', (url) =>
    expect(extraireCodeDepuisUrl(url)).toBeNull(),
  );
});

describe('conservation 7 jours', () => {
  it('garde le code et le rend tant qu’il a moins de 7 jours', async () => {
    await conserverCode('abc123', 'saisie', T0);
    expect(await lireCodeValide(T0)).toBe('ABC123');
    expect(await lireCodeValide(T0 + 6 * JOUR + 23 * 3600_000)).toBe('ABC123');
  });

  it('expire à 7 jours pile et efface le code', async () => {
    await conserverCode('abc123', 'lien', T0);
    expect(await lireCodeValide(T0 + DUREE_CONSERVATION_MS)).toBeNull();
    expect(await AsyncStorage.getItem(CLE_PARRAINAGE)).toBeNull();
  });

  it('un code plus récent remplace l’ancien et repart pour 7 jours', async () => {
    await conserverCode('ancien1', 'lien', T0);
    await conserverCode('nouveau2', 'saisie', T0 + 5 * JOUR);
    expect(await lireCodeValide(T0 + 10 * JOUR)).toBe('NOUVEAU2');
  });

  it('refuse un code invalide sans rien mémoriser ni suivre', async () => {
    expect(await conserverCode('a!', 'saisie', T0)).toBeNull();
    expect(await lireCodeValide(T0)).toBeNull();
    expect(suivre).not.toHaveBeenCalled();
  });

  it('ignore et efface un stockage corrompu ou une date dans le futur', async () => {
    await AsyncStorage.setItem(CLE_PARRAINAGE, '{oups');
    expect(await lireCodeValide(T0)).toBeNull();
    await AsyncStorage.setItem(CLE_PARRAINAGE, JSON.stringify({ code: 'ABC123', capturedAt: T0 + JOUR }));
    expect(await lireCodeValide(T0)).toBeNull();
    expect(await AsyncStorage.getItem(CLE_PARRAINAGE)).toBeNull();
  });

  it('effacerCode supprime le code', async () => {
    await conserverCode('abc123', 'saisie', T0);
    await effacerCode();
    expect(await lireCodeValide(T0)).toBeNull();
  });
});

describe('événement referral_code_captured', () => {
  it('source « saisie » pour une saisie manuelle', async () => {
    await conserverCode('abc123', 'saisie', T0);
    expect(suivre).toHaveBeenCalledWith('referral_code_captured', { source: 'saisie' });
  });

  it('source « lien » pour un lien profond, rien si le lien n’a pas de code', async () => {
    expect(await capturerDepuisUrl('elearnprepa://rejoindre/abc123', T0)).toBe('ABC123');
    expect(suivre).toHaveBeenCalledWith('referral_code_captured', { source: 'lien' });
    jest.clearAllMocks();
    expect(await capturerDepuisUrl('elearnprepa://moi', T0)).toBeNull();
    expect(suivre).not.toHaveBeenCalled();
  });
});
