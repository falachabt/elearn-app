import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { fr as x } from '@/i18n/fr';
import { passerAuToeic } from '@/services/changementProfil';
import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import { MOTS_TEST, REVISION_TEST, SEANCE_TEST } from '@/services/certification/__tests__/fixturesRevision';
import { ecrirePlan } from '@/services/certification/etat';
import { enregistrerProfil } from '@/services/profil';

import { ChoisirProfil } from '../../profil/ChoisirProfil';
import { MoiToeic } from '../MoiToeic';
import { monter } from './harnais';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => cb(), [cb]);
  },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), definirProprietesUtilisateur: jest.fn(), drapeauActif: jest.fn(() => true), ecouterDrapeaux: jest.fn(() => () => {}) }));
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
  it('marque le profil actuel et envoie le TOEIC vers la confirmation de Moi', async () => {
    await monter(<ChoisirProfil />);
    expect(await screen.findByText(x.profilChoix.actuel)).toBeTruthy();
    fireEvent.press(await screen.findByRole('radio', { name: new RegExp(`^${x.profilChoix.toeic}`) }));
    fireEvent.press(await screen.findByRole('button', { name: x.profilChoix.continuer }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/moi', params: { confirmer: 'toeic' } });
  });

  it('le secondaire passe par le choix de classe en mode modification', async () => {
    await monter(<ChoisirProfil />);
    fireEvent.press(await screen.findByRole('button', { name: x.profilChoix.continuer }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/classe', params: { type: 'eleve', modifier: '1' } });
  });
});

describe('P5 · Moi TOEIC : revenir au secondaire', () => {
  beforeEach(async () => {
    await passerAuToeic();
    await ecrirePlan({ exam: 'toeic', objectif: 800, dateTest: '2026-11-27', minutes: 20 });
  });

  it('ouvre la feuille et revient au secondaire mémorisé', async () => {
    await monter(<MoiToeic />);
    fireEvent.press(await screen.findByRole('button', { name: new RegExp(`^${x.certification.moiToeic.monProfil}`) }));
    expect(await screen.findByText(x.profilChoix.revenirTitre)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: x.profilChoix.revenirBouton }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  it('une écriture refusée affiche « Changement impossible » et garde le TOEIC', async () => {
    await monter(<MoiToeic />);
    fireEvent.press(await screen.findByRole('button', { name: new RegExp(`^${x.certification.moiToeic.monProfil}`) }));
    await screen.findByText(x.profilChoix.revenirTitre);
    const spy = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disque plein'));
    fireEvent.press(screen.getByRole('button', { name: x.profilChoix.revenirBouton }));
    expect(await screen.findByText(x.profilChoix.erreurTitre)).toBeTruthy();
    expect(screen.getByRole('button', { name: x.profilChoix.reessayer })).toBeTruthy();
    spy.mockRestore();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
