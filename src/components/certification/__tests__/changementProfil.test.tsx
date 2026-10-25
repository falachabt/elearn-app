import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { fr as x } from '@/i18n/fr';
import { passerAuToeic } from '@/services/changementProfil';
import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import { MOTS_TEST, REVISION_TEST, SEANCE_TEST } from '@/services/certification/__tests__/fixturesRevision';
import { enregistrerProfil } from '@/services/profil';

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

// Issue #125 : P2 garde sa liste des trois parcours, mais « Continuer » ouvre la page de changement sur
// l'onglet du parcours choisi — les anciennes feuilles de confirmation P4/P5 ont disparu.
describe('P2 · choix du profil', () => {
  it('marque le profil actuel ; Continuer sur le TOEIC ouvre la page de changement, onglet certification, sans feuille', async () => {
    await monter(<ChoisirProfil />);
    expect(await screen.findByText(x.profilChoix.actuel)).toBeTruthy();
    fireEvent.press(await screen.findByRole('radio', { name: new RegExp(`^${x.profilChoix.toeic}`) }));
    fireEvent.press(await screen.findByRole('button', { name: x.profilChoix.continuer }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/profil/changer', params: { onglet: 'certification', source: 'moi' } });
    expect(screen.queryByRole('button', { name: x.profilChoix.passerToeicBouton })).toBeNull();
  });

  it('depuis le TOEIC, Continuer vers le secondaire ouvre la page sur l’onglet secondaire', async () => {
    await passerAuToeic();
    await monter(<ChoisirProfil />);
    fireEvent.press(await screen.findByRole('radio', { name: new RegExp(`^${x.profilChoix.secondaire}`) }));
    fireEvent.press(await screen.findByRole('button', { name: x.profilChoix.continuer }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/profil/changer', params: { onglet: 'secondaire', source: 'moi' } });
    expect(screen.queryByRole('button', { name: x.profilChoix.revenirBouton })).toBeNull();
  });

  it('sans changement de sélection, Continuer ouvre la page sur l’onglet de la famille actuelle', async () => {
    await monter(<ChoisirProfil />);
    fireEvent.press(await screen.findByRole('button', { name: x.profilChoix.continuer }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/profil/changer', params: { onglet: 'secondaire', source: 'moi' } });
  });
});
