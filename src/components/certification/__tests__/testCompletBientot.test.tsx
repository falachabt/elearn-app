import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { fr } from '@/i18n/fr';
import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import type { DefTest } from '@/services/certification/types';
import { enregistrerProfil } from '@/services/profil';

import { ListeTests } from '../ListeTests';
import { TestBientot } from '../TestBientot';
import { TestsToeic } from '../TestsToeic';
import { monter } from './harnais';

const t = fr.certification.tests;
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => cb(), []);
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), definirProprietesUtilisateur: jest.fn(), drapeauActif: jest.fn(() => true), ecouterDrapeaux: jest.fn(() => () => {}) }));
jest.mock('expo-audio', () => ({ createAudioPlayer: jest.fn() }));
jest.mock('@/session/CreditsProvider', () => ({
  useCredits: () => ({
    solde: { illimite: false, total: 12, semaine: 0, recompenses: 0, recharge: 25, rechargeHebdo: true, prochaineRecharge: '2026-10-19T00:00:00Z', illimiteJusqua: null, expirationRecompenses: null },
    reglages: { bienvenue: 40, invite: 5, recharge: 25 },
    couts: { cert_mock_mini_ten: 1, cert_mock_mini_twenty: 2, cert_mock_full: 15 },
    depenser: jest.fn(),
    rafraichir: jest.fn(),
  }),
}));

const FULL: DefTest[] = [
  { id: 'f1', kind: 'full', part: null, numero: 1, questions: 200, tentatives: 0, fini: false, meilleurScoreMax: null, derniereDate: null, nouvellesQuestions: 200 },
];
const demarrer = jest.fn();

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = {};
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: true });
  const fausse = creerApiFausse();
  definirApi({ ...fausse.api, listerDefsTests: async (_e, type) => FULL.filter((x) => !type || x.kind === type), demarrerDefTest: demarrer as never, demarrerTest: demarrer as never });
});
afterEach(() => definirApi(null));

describe('test complet : « Bientôt », jamais lançable', () => {
  it('onglet Tests : la carte porte « Bientôt » et ne mène nulle part', async () => {
    await monter(<TestsToeic />);
    expect(await screen.findByText(t.statut.bientot)).toBeTruthy();
    fireEvent.press(screen.getByText(t.complet));
    expect(router.push).not.toHaveBeenCalled();
    expect(demarrer).not.toHaveBeenCalled();
  });

  it('liste des tests complets : lignes « Bientôt », aucun départ, pas de bouton collant', async () => {
    mockParams = { kind: 'full' };
    await monter(<ListeTests />);
    const ligne = await screen.findByTestId('ligne-full-1');
    expect(screen.getAllByText(t.statut.bientot).length).toBeGreaterThan(0);
    fireEvent.press(ligne);
    expect(demarrer).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.queryByText(/Commencer Test complet/)).toBeNull();
  });

  it('écran T6 : titre, texte et bouton désactivé', async () => {
    mockParams = { kind: 'full' };
    await monter(<TestBientot />);
    expect(await screen.findByText(t.bientotSousTitre)).toBeTruthy();
    expect(screen.getByText(t.bientotTexte)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.bientotLancer }).props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(screen.getByText(t.bientotLancer));
    expect(demarrer).not.toHaveBeenCalled();
  });
});
