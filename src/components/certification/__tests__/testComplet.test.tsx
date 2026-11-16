import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { fr } from '@/i18n/fr';
import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import type { DefTest } from '@/services/certification/types';
import { enregistrerProfil } from '@/services/profil';

import { LancementTestComplet } from '../LancementTestComplet';
import { ListeTests } from '../ListeTests';
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

const m = fr.certification.mini;

describe('test complet : actif, avec barre d\'avancement', () => {
  it('onglet Tests : la carte n\'est plus « Bientôt », elle ouvre la liste des tests complets', async () => {
    await monter(<TestsToeic />);
    fireEvent.press(await screen.findByText(t.complet));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/liste-tests', params: { kind: 'full' } });
    expect(screen.queryByText(t.statut.bientot)).toBeNull();
  });

  it('onglet Tests : barre « x faits sur n » sur la carte du test complet', async () => {
    await monter(<TestsToeic />);
    await screen.findByText(t.complet);
    expect(screen.getAllByLabelText(t.avancementUn.replace('{{faits}}', '0').replace('{{total}}', '1')).length).toBeGreaterThan(0);
  });

  it('liste des tests complets : toucher une ligne ouvre l\u2019\u00e9cran de lancement, sans d\u00e9bit', async () => {
    mockParams = { kind: 'full' };
    await monter(<ListeTests />);
    fireEvent.press(await screen.findByTestId('ligne-full-1'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/lancement-complet', params: { id: 'f1', numero: '1' } });
    expect(demarrer).not.toHaveBeenCalled();
  });
});

describe('lancement du test complet', () => {
  beforeEach(() => {
    mockParams = { id: 'f1', numero: '1' };
  });

  it('montre les r\u00e8gles et le co\u00fbt lu du serveur, \u00ab Plus tard \u00bb ne d\u00e9bite rien', async () => {
    await monter(<LancementTestComplet />);
    expect(await screen.findByText(fr.certification.lancementComplet.chronoTitre)).toBeTruthy();
    expect(screen.getByText(fr.certification.lancementComplet.audioTitre)).toBeTruthy();
    expect(screen.getByText('15 cr\u00e9dits')).toBeTruthy();
    fireEvent.press(screen.getByText(fr.certification.lancementComplet.plusTard));
    expect(router.back).toHaveBeenCalled();
    expect(demarrer).not.toHaveBeenCalled();
  });

  it('\u00ab Commencer le test \u00bb sans cr\u00e9dits suffisants ouvre la feuille et ne lance rien', async () => {
    demarrer.mockResolvedValue({ status: 'insufficient', tentative: null, cout: 15, solde: 3 });
    await monter(<LancementTestComplet />);
    fireEvent.press(await screen.findByText(fr.certification.lancementComplet.commencer));
    await screen.findAllByText(/15/);
    expect(demarrer).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('invit\u00e9 : la feuille \u00ab Cr\u00e9e un compte \u00bb s\u2019ouvre', async () => {
    demarrer.mockResolvedValue({ status: 'account_required', tentative: null });
    await monter(<LancementTestComplet />);
    fireEvent.press(await screen.findByText(fr.certification.lancementComplet.commencer));
    expect(await screen.findByText(m.compteFeuilleTitre)).toBeTruthy();
  });
});
