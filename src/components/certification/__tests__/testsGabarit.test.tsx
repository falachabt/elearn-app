import AsyncStorage from '@react-native-async-storage/async-storage';
import { screen } from '@testing-library/react-native';

import { fr } from '@/i18n/fr';
import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import type { DefTest } from '@/services/certification/types';
import { enregistrerProfil } from '@/services/profil';

import { TestsToeic } from '../TestsToeic';
import { monter } from './harnais';

const t = fr.certification.tests;

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => cb(), []);
  },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), definirProprietesUtilisateur: jest.fn(), drapeauActif: jest.fn(() => true), ecouterDrapeaux: jest.fn(() => () => {}) }));
jest.mock('expo-audio', () => ({ createAudioPlayer: jest.fn() }));
jest.mock('@/session/CreditsProvider', () => ({
  useCredits: () => ({
    solde: { illimite: false, total: 12, semaine: 0, recompenses: 0, recharge: 25, rechargeHebdo: true, prochaineRecharge: '2026-10-19T00:00:00Z', illimiteJusqua: null, expirationRecompenses: null },
    reglages: { bienvenue: 40, invite: 5, recharge: 25 },
    couts: { cert_mock_mini_ten: 1, cert_mock_mini_twenty: 2 },
    depenser: jest.fn(),
    rafraichir: jest.fn(),
  }),
}));

const def = (id: string, kind: DefTest['kind'], part: number | null, numero: number, extra: Partial<DefTest> = {}): DefTest => ({
  id, kind, part, numero, questions: 10, tentatives: 0, fini: false, meilleurScoreMax: null, derniereDate: null, nouvellesQuestions: 10, ...extra,
});
const DEFS: DefTest[] = [
  def('a', 'mini', 5, 1, { fini: true, tentatives: 1, meilleurScoreMax: 8 }),
  def('b', 'mini', 5, 2),
  def('c', 'mini', 5, 3),
  def('x', 'mixed', null, 1, { questions: 20 }),
  def('l1', 'listening', null, 1, { questions: 100, fini: true, tentatives: 1, meilleurScoreMax: 410 }),
  def('l2', 'listening', null, 2, { questions: 100 }),
  def('r1', 'reading', null, 1, { questions: 100 }),
  def('f1', 'full', null, 1, { questions: 200 }),
];

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: true });
  const fausse = creerApiFausse({
    tentatives: [{ id: 'h1', kind: 'mini', part: 5, length: 10, status: 'finished', score: null, scoreMin: null, scoreMax: null, startedAt: '2026-10-12T10:00:00Z', finishedAt: '2026-10-12T10:08:00Z', perPart: { '5': { answered: 10, correct: 8 } }, timePerPart: null, creditsSpent: 1, refunded: false, questions: [] }],
  });
  definirApi({
    ...fausse.api,
    listerDefsTests: async (_exam, type) => DEFS.filter((x) => !type || x.kind === type),
    lireProgressionTests: async () => [
      { kind: 'half_listening', statut: 'fait', tentatives: 1, dernierScore: 410, meilleurScore: 410, derniereDate: '2026-10-18', tentativeEnCours: false },
      { kind: 'half_reading', statut: 'fait', tentatives: 3, dernierScore: 385, meilleurScore: 705, derniereDate: '2026-10-18', tentativeEnCours: false },
      { kind: 'full', statut: 'pas_fait', tentatives: 0, dernierScore: null, meilleurScore: null, derniereDate: null, tentativeEnCours: false },
    ],
  });
});
afterEach(() => definirApi(null));

describe('onglet Tests : gabarit large des cartes (maquette v36, v37)', () => {
  it('chaque type affiche « x faits sur n » avec une barre de progression (D-57)', async () => {
    await monter(<TestsToeic />);
    // Mini par partie : 1 fait sur 3 ; demi-test écoute : 1 sur 2 ; lecture : 0 sur 1 ; mixte : 0 sur 1.
    expect(await screen.findByLabelText(t.avancementUn.replace('{{faits}}', '1').replace('{{total}}', '3'))).toBeTruthy();
    expect(screen.getByLabelText(t.avancementUn.replace('{{faits}}', '1').replace('{{total}}', '2'))).toBeTruthy();
    expect(screen.getAllByLabelText(t.avancementUn.replace('{{faits}}', '0').replace('{{total}}', '1')).length).toBe(2);
  });

  it('le meilleur score se lit « 8 sur 10 » (D-58), jamais au-dessus de la section (705 devient 495)', async () => {
    await monter(<TestsToeic />);
    expect((await screen.findAllByText(/^8 sur 10$/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^410 sur 495$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^495 sur 495$/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/705/)).toBeNull();
  });
});
