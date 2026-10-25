import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import type { DefTest } from '@/services/certification/types';
import { enregistrerProfil } from '@/services/profil';

import { ListeTests } from '../ListeTests';
import { fr } from '@/i18n/fr';

import { monter } from './harnais';


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

describe('liste des mini-tests d’une partie (v39)', () => {
  it('ne montre que la partie choisie, numérotée dans la partie', async () => {
    mockParams = { kind: 'mini', partie: '5' };
    await monter(<ListeTests />);
    expect(await screen.findByText('n° 1')).toBeTruthy();
    expect(screen.getByTestId('ligne-mini-3')).toBeTruthy();
    expect(screen.getByTestId('ligne-mini-5')).toBeTruthy();
    expect(screen.queryByTestId('ligne-mini-1')).toBeNull();
    expect(screen.getByText(/Meilleur : 7 sur 10/)).toBeTruthy();
  });

  it('sans partie valide, renvoie vers le choix de la partie', async () => {
    mockParams = { kind: 'mini' };
    await monter(<ListeTests />);
    expect(router.replace).toHaveBeenCalledWith('/certification/choix-partie');
  });

  it('le mixte liste ses tests sous leur type, sans partie', async () => {
    mockParams = { kind: 'mixed' };
    await monter(<ListeTests />);
    expect(await screen.findByText('Mixte n° 1')).toBeTruthy();
    expect(screen.getByTestId('ligne-mixed-1')).toBeTruthy();
  });
});

describe('total affiché sur les cartes (décision de Benny du 25 octobre 2026)', () => {
  it('un mini affiche son total réel, pas ses questions nouvelles (cas de la capture : 10 au lieu de 6 nouvelles)', async () => {
    mockParams = { kind: 'mini', partie: '2' };
    installer([
      mini('p2a', 2, 1, { nouvellesQuestions: 5 }),
      mini('p2b', 2, 2, { nouvellesQuestions: 6 }),
    ]);
    await monter(<ListeTests />);
    expect(await screen.findByText('n° 1')).toBeTruthy();
    // Une ligne de total par carte, au total de la définition (10), jamais la nouveauté (5 ou 6).
    expect(screen.getAllByText('10 questions')).toHaveLength(2);
    expect(screen.queryByText(/questions nouvelles pour toi/)).toBeNull();
  });

  it('un demi-test affiche son total réel (100), pas ses questions nouvelles (76)', async () => {
    mockParams = { kind: 'listening' };
    installer([{ ...mini('l1', null, 1, { questions: 100, nouvellesQuestions: 76 }), kind: 'listening' }]);
    await monter(<ListeTests />);
    expect(await screen.findByText('Écoute n° 1')).toBeTruthy();
    expect(screen.getByText('100 questions')).toBeTruthy();
    expect(screen.queryByText(/questions nouvelles pour toi/)).toBeNull();
  });
});

describe('départ depuis la liste d’un mini-test (v39)', () => {
  it('le coût du mini-test est affiché dans la liste de la partie, avec son nombre de questions', async () => {
    mockParams = { kind: 'mini', partie: '5' };
    await monter(<ListeTests />);
    expect(await screen.findByText(`10 questions · ${fr.credits.coutUn} hors Pass`)).toBeTruthy();
  });

  it('une partie servie à 12 questions l’annonce dans l’en-tête (partie 6, nombre lu dans les définitions)', async () => {
    mockParams = { kind: 'mini', partie: '6' };
    installer([
      mini('g', 6, 1, { questions: 12, nouvellesQuestions: 12 }),
      mini('h', 6, 2, { questions: 12, nouvellesQuestions: 12 }),
    ]);
    await monter(<ListeTests />);
    expect(await screen.findByText(`12 questions · ${fr.credits.coutUn} hors Pass`)).toBeTruthy();
  });

  it('crédits insuffisants : le serveur refuse, aucun test ne s’ouvre', async () => {
    mockParams = { kind: 'mini', partie: '5' };
    const demarrer = jest.fn(async (_clientUuid: string, _defId: string, _exam: string, _jour: string) => ({ status: 'insufficient' as const, tentative: null, cout: 1, solde: 0 }));
    definirApi({ ...fausse.api, listerDefsTests: async (_e, type) => LIGNES.filter((l) => !type || l.kind === type), demarrerDefTest: demarrer });
    await monter(<ListeTests />);
    fireEvent.press(await screen.findByTestId('ligne-mini-4'));
    expect(await screen.findByText(fr.certification.tests.creditsInsuffisants)).toBeTruthy();
    expect(demarrer.mock.calls[0]?.[1]).toBe('d');
    expect(demarrer.mock.calls[0]?.[2]).toBe('toeic');
    expect(router.push).not.toHaveBeenCalledWith('/certification/mini-test');
    expect(router.replace).not.toHaveBeenCalledWith('/certification/mini-test');
  });

  it('départ accepté : la tentative du serveur est gardée et l’écran du mini-test s’ouvre', async () => {
    mockParams = { kind: 'mini', partie: '5' };
    definirApi({
      ...fausse.api,
      listerDefsTests: async (_e, type) => LIGNES.filter((l) => !type || l.kind === type),
      demarrerDefTest: async (clientUuid) => fausse.api.demarrerMini(clientUuid, 'toeic', 5, 10, '2030-06-01'),
    });
    await monter(<ListeTests />);
    fireEvent.press(await screen.findByTestId('ligne-mini-5'));
    await screen.findByTestId('ligne-mini-5');
    expect(router.replace).toHaveBeenCalledWith('/certification/mini-test');
  });
});
