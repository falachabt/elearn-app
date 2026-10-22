import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { fr } from '@/i18n/fr';
import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import type { DefTest } from '@/services/certification/types';
import { enregistrerProfil } from '@/services/profil';

import { ChoixPartie } from '../ChoixPartie';
import { monter } from './harnais';

const t = fr.certification.tests.listes;

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  // Une fois au montage : le rappel de l'écran change à chaque rendu, il ne doit pas relancer le chargement.
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => cb(), []);
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), definirProprietesUtilisateur: jest.fn(), drapeauActif: jest.fn(() => true), ecouterDrapeaux: jest.fn(() => () => {}) }));
jest.mock('@/session/CreditsProvider', () => ({
  useCredits: () => ({
    solde: { illimite: false, total: 12, semaine: 0, recompenses: 0, recharge: 25, rechargeHebdo: true, prochaineRecharge: '2026-10-19T00:00:00Z', illimiteJusqua: null, expirationRecompenses: null },
    reglages: { bienvenue: 40, invite: 5, recharge: 25 },
    couts: { cert_mock_mini_ten: 1, cert_mock_mini_twenty: 2 },
    depenser: jest.fn(),
    rafraichir: jest.fn(),
  }),
}));

const mini = (id: string, part: number | null, numero: number, extra: Partial<DefTest> = {}): DefTest => ({
  id, kind: 'mini', part, numero, questions: 10, tentatives: 0, fini: false, meilleurScoreMax: null, derniereDate: null, nouvellesQuestions: 10, ...extra,
});
const LIGNES: DefTest[] = [
  mini('a', 1, 1, { fini: true, tentatives: 1, meilleurScoreMax: 8, nouvellesQuestions: 0 }),
  mini('b', 1, 2),
  mini('c', 5, 3, { fini: true, tentatives: 1, meilleurScoreMax: 7, nouvellesQuestions: 0 }),
  mini('d', 5, 4, { tentatives: 1, nouvellesQuestions: 6 }),
  mini('e', 5, 5),
  { ...mini('m', null, 1, { questions: 20 }), kind: 'mixed' },
];

let fausse: ReturnType<typeof creerApiFausse>;
const installer = (tests: DefTest[]) => {
  fausse = creerApiFausse();
  // Comme le serveur : la liste d'un type ne renvoie que les tests de ce type.
  definirApi({ ...fausse.api, listerDefsTests: async (_exam, type) => tests.filter((t) => !type || t.kind === type) });
};

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = {};
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: true });
  installer(LIGNES);
});
afterEach(() => definirApi(null));

describe('choix de la partie (v39)', () => {
  it('liste P1 à P7 avec le fait, et « Conseillé » sur la partie qui a le plus de questions nouvelles', async () => {
    await monter(<ChoixPartie />);
    expect(await screen.findByText(t.choixPartie.partie.replace('{{partie}}', '1'))).toBeTruthy();
    expect(screen.getByText(t.choixPartie.faits.replace('{{faits}}', '1').replace('{{total}}', '2'))).toBeTruthy();
    expect(screen.getByText(t.choixPartie.conseille)).toBeTruthy();
    // Une partie sans test ne s'affiche pas.
    expect(screen.queryByTestId('partie-7')).toBeNull();
    expect(screen.getByTestId('mixte')).toBeTruthy();
  });

  it('une partie ouvre la liste de ses mini-tests ; le mixte ouvre sa liste sans partie', async () => {
    await monter(<ChoixPartie />);
    fireEvent.press(await screen.findByTestId('partie-5'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/liste-tests', params: { kind: 'mini', partie: '5' } });
    fireEvent.press(screen.getByTestId('mixte'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/liste-tests', params: { kind: 'mixed' } });
  });
});

