import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { fr as x } from '@/i18n/fr';
import { passerAuToeic } from '@/services/changementProfil';
import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import { MOTS_TEST, REVISION_TEST, SEANCE_TEST } from '@/services/certification/__tests__/fixturesRevision';
import { ecrirePlan } from '@/services/certification/etat';
import { CLE_PROFIL, enregistrerProfil, lireProfil } from '@/services/profil';

import { ChoisirCertification } from '../../profil/ChoisirCertification';
import { ChoisirProfil } from '../../profil/ChoisirProfil';
import { monter } from './harnais';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissAll: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => cb(), [cb]);
  },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), drapeauActif: jest.fn(() => true), ecouterDrapeaux: jest.fn(() => () => {}), definirProprietesUtilisateur: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-profil' }));
jest.mock('../../credits/CompteurCredits', () => ({ CompteurCredits: () => null }));
jest.mock('../../../services/reglagesLocaux', () => ({ signalerModification: jest.fn(async () => {}) }));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'eleve', niveau: 'Tle', pays: 'CM', termine: true });
  definirApi(creerApiFausse({ revision: REVISION_TEST, carnet: MOTS_TEST, seance: SEANCE_TEST }).api);
});

describe('P2 · choix du profil', () => {
  it('marque le profil actuel, puis Continuer pose la feuille P4 sur la page sans quitter P2', async () => {
    await monter(<ChoisirProfil />);
    expect(await screen.findByText(x.profilChoix.actuel)).toBeTruthy();
    fireEvent.press(await screen.findByRole('radio', { name: new RegExp(`^${x.profilChoix.toeic}`) }));
    fireEvent.press(await screen.findByRole('button', { name: x.profilChoix.continuer }));
    expect(router.push).not.toHaveBeenCalledWith('/profil/certification');
    expect(await screen.findByRole('button', { name: x.profilChoix.passerToeicBouton })).toBeTruthy();
  });

  it('depuis le TOEIC, Continuer vers le secondaire pose la feuille P5 ; la confirmation restaure le secondaire mémorisé', async () => {
    await passerAuToeic();
    await monter(<ChoisirProfil />);
    fireEvent.press(await screen.findByRole('radio', { name: new RegExp(`^${x.profilChoix.secondaire}`) }));
    fireEvent.press(await screen.findByRole('button', { name: x.profilChoix.continuer }));
    fireEvent.press(await screen.findByRole('button', { name: x.profilChoix.revenirBouton }));
    await waitFor(async () => expect((await lireProfil())?.type).toBe('eleve'));
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('le secondaire passe par le choix de classe en mode modification', async () => {
    await monter(<ChoisirProfil />);
    fireEvent.press(await screen.findByRole('button', { name: x.profilChoix.continuer }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/classe', params: { type: 'eleve', modifier: '1' } });
  });
});

describe('Page certification : TOEIC', () => {
  it('profil déjà TOEIC : confirmer revient sans rien écrire', async () => {
    await passerAuToeic();
    const avant = await AsyncStorage.getItem(CLE_PROFIL);
    await monter(<ChoisirCertification />);
    fireEvent.press(await screen.findByRole('button', { name: x.profilChoix.continuer }));
    expect(router.back).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    // Rien n'est réécrit : l'octet-près du profil stocké est identique.
    expect(await AsyncStorage.getItem(CLE_PROFIL)).toBe(avant);
  });

  it('profil secondaire : confirmer passe au TOEIC puis va sur l’accueil TOEIC', async () => {
    await monter(<ChoisirCertification />);
    fireEvent.press(await screen.findByRole('button', { name: x.profilChoix.passerToeicBouton }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect((await lireProfil())?.type).toBe('certification');
  });

  it('une écriture refusée affiche « Changement impossible » et garde le profil', async () => {
    await monter(<ChoisirCertification />);
    const spy = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disque plein'));
    fireEvent.press(await screen.findByRole('button', { name: x.profilChoix.passerToeicBouton }));
    expect(await screen.findByText(x.profilChoix.erreurTitre)).toBeTruthy();
    spy.mockRestore();
    expect((await lireProfil())?.type).toBe('eleve');
    expect(router.replace).not.toHaveBeenCalled();
  });
});

