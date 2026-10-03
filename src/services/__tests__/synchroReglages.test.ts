import AsyncStorage from '@react-native-async-storage/async-storage';

import { changerLangue, i18n } from '@/i18n';
import { typo } from '@/theme/theme';

import { definirTheme, definirTaille, reinitialiserAffichage } from '../affichage';
import { definirWifiSeulement } from '../donnees';
import { enregistrerProfil, lireProfil } from '../profil';
import { CLE_MAJ_REGLAGES, lireMajReglages } from '../reglagesLocaux';
import { definirPreference, lirePreferences, PREFERENCES_PAR_DEFAUT, appliquerPreferences } from '../retours';
import { construireReglages, suivreModifications, synchroniserReglages } from '../synchroReglages';

jest.mock('../analytics', () => ({ suivre: jest.fn() }));

const client = (session: unknown = { user: { id: 'u1' } }) => ({
  auth: {
    getSession: jest.fn().mockResolvedValue({ data: { session } }),
    updateUser: jest.fn().mockResolvedValue({ data: {}, error: null }),
  },
});

beforeEach(async () => {
  await AsyncStorage.clear();
  reinitialiserAffichage();
  await appliquerPreferences(PREFERENCES_PAR_DEFAUT);
  await changerLangue('fr');
  await AsyncStorage.removeItem(CLE_MAJ_REGLAGES);
});

it('une modification locale date les réglages', async () => {
  expect(await lireMajReglages()).toBeNull();
  await definirPreference('sons', false);
  expect(await lireMajReglages()).not.toBeNull();
});

it('compte vide : les réglages du téléphone sont copiés dans le compte', async () => {
  await definirPreference('vibrations', false);
  await enregistrerProfil({ type: 'eleve', niveau: '4e', pays: 'SN', termine: true });
  const c = client();
  expect(await synchroniserReglages(c as never, { user_metadata: {} })).toBe('envoye');
  expect(c.auth.updateUser).toHaveBeenCalledWith({
    data: { reglages: expect.objectContaining({ preferences: expect.objectContaining({ vibrations: false }), langue: 'fr', profil: { type: 'eleve', niveau: '4e', pays: 'SN', concours: null } }) },
  });
});

it('compte plus récent (autre téléphone) : appliqué ici sans être renvoyé, parcours d’arrivée terminé', async () => {
  await definirPreference('sons', true);
  const distants = {
    preferences: { sons: false, vibrations: false, animationsReduites: true },
    langue: 'en',
    profil: { type: 'concours', niveau: 'medecine', pays: 'CM' },
    maj: new Date(Date.now() + 60_000).toISOString(),
  };
  const c = client();
  expect(await synchroniserReglages(c as never, { user_metadata: { reglages: distants } })).toBe('applique');
  expect(lirePreferences()).toEqual({ ...distants.preferences, volume: 'normal' }); // réglages d’une ancienne version : volume inchangé
  expect(i18n.language).toBe('en');
  expect(await lireProfil()).toEqual({ type: 'concours', niveau: 'medecine', pays: 'CM', concours: null, termine: true });
  expect(await lireMajReglages()).toBe(distants.maj);
  expect(c.auth.updateUser).not.toHaveBeenCalled();
});

it('téléphone plus récent : le compte est mis à jour', async () => {
  const c = client();
  await definirPreference('animationsReduites', true);
  const vieux = { ...(await construireReglages('2020-01-01T00:00:00.000Z')), preferences: { ...PREFERENCES_PAR_DEFAUT } };
  expect(await synchroniserReglages(c as never, { user_metadata: { reglages: vieux } })).toBe('envoye');
  expect(lirePreferences().animationsReduites).toBe(true);
});

it('synchronise aussi le thème, la taille du texte et le mode Wi-Fi', async () => {
  const c = client();
  await definirTheme('sombre');
  await definirTaille(110);
  await definirWifiSeulement(true);
  expect(await synchroniserReglages(c as never, { user_metadata: {} })).toBe('envoye');
  expect(c.auth.updateUser).toHaveBeenCalledWith({
    data: { reglages: expect.objectContaining({ affichage: { theme: 'sombre', taille: 110 }, wifiSeulement: true }) },
  });
});

it('remplace les styles partagés quand la taille du texte change pour redessiner les titres', async () => {
  const styleAvant = typo.h1;

  await definirTaille(90);

  expect(typo.h1).not.toBe(styleAvant);
  expect(typo.h1.fontSize).toBe(23.4);
  expect(typo.h1.lineHeight).toBe(29);
});

it('sans session : rien n’est envoyé', async () => {
  const c = client(null);
  await definirPreference('sons', false);
  expect(await synchroniserReglages(c as never, { user_metadata: {} })).toBe('rien');
  expect(c.auth.updateUser).not.toHaveBeenCalled();
});

it('chaque changement local est copié dans le compte, regroupé', async () => {
  jest.useFakeTimers();
  const c = client();
  const arreter = suivreModifications(c as never, 500);
  try {
    await definirPreference('sons', false);
    await definirPreference('vibrations', false);
    await jest.advanceTimersByTimeAsync(600);
    expect(c.auth.updateUser).toHaveBeenCalledTimes(1);
  } finally {
    arreter();
    jest.useRealTimers();
  }
});
