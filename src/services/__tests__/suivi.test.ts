import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from '@testing-library/react-native';

import { i18n } from '@/i18n';

import { definirProprietesGlobales, definirProprietesUtilisateur, suivre, vider } from '../analytics';
import { definirConnectivitePourTest } from '../connectivite';
import { CLE_PROFIL } from '../profil';
import { signalerModification } from '../reglagesLocaux';
import { CLE_PREMIER_LANCEMENT, demarrerSuivi, nomEcran, synchroniserProprietes } from '../suivi';

jest.mock('../analytics', () => ({
  analyticsActif: jest.fn(() => true),
  definirProprietesGlobales: jest.fn(),
  definirProprietesUtilisateur: jest.fn(),
  suivre: jest.fn(),
  vider: jest.fn(() => Promise.resolve()),
}));

const attendre = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  definirConnectivitePourTest({ connecte: true, internet: true, backend: true });
});

describe('nomEcran', () => {
  it('retire les groupes de routes et ne garde que le modèle de la route', () => {
    expect(nomEcran(['(onglets)', 'moi'])).toBe('/moi');
    expect(nomEcran(['cours', 'lecon'])).toBe('/cours/lecon');
    expect(nomEcran(['paiements', '[id]'])).toBe('/paiements/[id]');
    expect(nomEcran(['(onglets)', 'index'])).toBe('/index');
    expect(nomEcran([])).toBe('/index');
  });
});

describe('propriétés de la personne', () => {
  it('suit classe, statut, pays, langues, plateforme et version, sans donnée personnelle', async () => {
    await AsyncStorage.setItem(CLE_PROFIL, JSON.stringify({ type: 'eleve', niveau: '3e', pays: 'CM', termine: true }));
    await synchroniserProprietes();
    expect(definirProprietesUtilisateur).toHaveBeenCalledTimes(1);
    const p = (definirProprietesUtilisateur as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(p).toMatchObject({ statut: 'eleve', classe: '3e', filiere: null, pays: 'CM', langue_telephone: 'fr', langue_app: i18n.language });
    expect(p).toHaveProperty('plateforme');
    expect(p).toHaveProperty('version_app');
    expect(Object.keys(p).filter((k) => /^(email|phone|nom|prenom)$/.test(k))).toEqual([]);
    expect(definirProprietesGlobales).toHaveBeenCalledWith(expect.objectContaining({ langue_telephone: 'fr' }));
  });

  it('candidat à un concours : filière et concours, pas de classe', async () => {
    await AsyncStorage.setItem(
      CLE_PROFIL,
      JSON.stringify({ type: 'concours', niveau: 'sante', pays: 'CI', concours: { id: 'c1', sigle: 'INFAS', nom: 'Institut' }, termine: true }),
    );
    await synchroniserProprietes();
    expect((definirProprietesUtilisateur as jest.Mock).mock.calls[0][0]).toMatchObject({ statut: 'concours', classe: null, filiere: 'sante', concours: 'INFAS', pays: 'CI' });
  });

  it('se remet à jour quand un réglage change (profil, langue)', async () => {
    const arreter = demarrerSuivi();
    await attendre();
    (definirProprietesUtilisateur as jest.Mock).mockClear();
    await AsyncStorage.setItem(CLE_PROFIL, JSON.stringify({ type: 'eleve', niveau: '1re', pays: 'SN', termine: true }));
    await act(async () => {
      await signalerModification();
      await new Promise((r) => setTimeout(r, 20));
    });
    expect((definirProprietesUtilisateur as jest.Mock).mock.calls.at(-1)?.[0]).toMatchObject({ classe: '1re', pays: 'SN' });
    arreter();
  });
});

describe('premier lancement', () => {
  it('n’est compté qu’une fois', async () => {
    const a1 = demarrerSuivi();
    await attendre();
    expect(suivre).toHaveBeenCalledWith('app_first_open', expect.objectContaining({ plateforme: expect.any(String), langue: expect.any(String) }));
    expect(await AsyncStorage.getItem(CLE_PREMIER_LANCEMENT)).not.toBeNull();
    a1();
    (suivre as jest.Mock).mockClear();
    const a2 = demarrerSuivi();
    await attendre();
    expect(suivre).not.toHaveBeenCalledWith('app_first_open', expect.anything());
    a2();
  });
});

describe('coupures du réseau', () => {
  it('compte la coupure, sa durée, et vide la file locale au retour du réseau', async () => {
    const arreter = demarrerSuivi();
    await attendre();
    (suivre as jest.Mock).mockClear();

    act(() => definirConnectivitePourTest({ connecte: false, internet: false }));
    expect(suivre).toHaveBeenCalledWith('connectivity_lost', {});
    expect(vider).not.toHaveBeenCalled();

    // Un changement qui laisse l'état « hors ligne » ne compte pas deux fois.
    act(() => definirConnectivitePourTest({ enVerification: true }));
    expect(suivre).toHaveBeenCalledTimes(1);

    act(() => definirConnectivitePourTest({ connecte: true, internet: true, backend: true, enVerification: false }));
    expect(suivre).toHaveBeenCalledWith('connectivity_restored', { duree_s: expect.any(Number) });
    expect(vider).toHaveBeenCalledTimes(1);
    arreter();
  });

  it('un serveur injoignable avec réseau actif compte aussi comme une coupure', async () => {
    const arreter = demarrerSuivi();
    await attendre();
    (suivre as jest.Mock).mockClear();
    act(() => definirConnectivitePourTest({ backend: false }));
    expect(suivre).toHaveBeenCalledWith('connectivity_lost', {});
    arreter();
  });
});

describe('arrêt', () => {
  it('ne suit plus rien une fois arrêté', async () => {
    const arreter = demarrerSuivi();
    await attendre();
    arreter();
    (suivre as jest.Mock).mockClear();
    act(() => definirConnectivitePourTest({ connecte: false, internet: false }));
    expect(suivre).not.toHaveBeenCalled();
  });
});
