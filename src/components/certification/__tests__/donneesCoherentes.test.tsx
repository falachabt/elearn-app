import AsyncStorage from '@react-native-async-storage/async-storage';
import { screen } from '@testing-library/react-native';

import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import { scoreBorne } from '@/services/certification/listesTests';
import type { DefTest } from '@/services/certification/types';
import { enregistrerProfil } from '@/services/profil';

import { ListeTests } from '../ListeTests';
import { StatistiquesToeic } from '../StatistiquesToeic';
import { monter } from './harnais';

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
jest.mock('@/session/CreditsProvider', () => ({
  useCredits: () => ({
    solde: { illimite: false, total: 12, semaine: 0, recompenses: 0, recharge: 25, rechargeHebdo: true, prochaineRecharge: '2026-10-19T00:00:00Z', illimiteJusqua: null, expirationRecompenses: null },
    reglages: { bienvenue: 40, invite: 5, recharge: 25 },
    couts: { cert_mock_mini_ten: 1, cert_mock_mini_twenty: 2 },
    depenser: jest.fn(),
    rafraichir: jest.fn(),
  }),
}));

const def = (id: string, kind: DefTest['kind'], numero: number, questions: number, extra: Partial<DefTest> = {}): DefTest => ({
  id, kind, part: null, numero, questions, tentatives: 1, fini: true, meilleurScoreMax: null, derniereDate: null, nouvellesQuestions: 0, ...extra,
});
const installer = (tests: DefTest[]) => {
  const fausse = creerApiFausse();
  definirApi({ ...fausse.api, listerDefsTests: async (_e, type) => tests.filter((x) => !type || x.kind === type) });
};

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = {};
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: true });
});
afterEach(() => definirApi(null));

describe('scoreBorne : jamais au-dessus du maximum de sa section', () => {
  it('une section se lit sur 495, un mixte sur ses questions, un mini sur ses questions', () => {
    expect(scoreBorne('reading', 705, 100, 990)).toEqual({ valeur: 495, max: 495 });
    expect(scoreBorne('listening', 410, 100, 990)).toEqual({ valeur: 410, max: 495 });
    expect(scoreBorne('mixed', 13, 20, 990)).toEqual({ valeur: 13, max: 20 });
    expect(scoreBorne('mini', 7, 10, 990)).toEqual({ valeur: 7, max: 10 });
    expect(scoreBorne('mini', 12, 10, 990)).toEqual({ valeur: 10, max: 10 });
    expect(scoreBorne('full', 1200, 200, 990)).toEqual({ valeur: 990, max: 990 });
    expect(scoreBorne('mini', null, 10, 990)).toBeNull();
  });
  it('un ancien mixte estimé sur 990 reste lisible sur 990', () => {
    expect(scoreBorne('mixed', 550, 20, 990)).toEqual({ valeur: 550, max: 990 });
  });
});

describe('listes : des chiffres cohérents', () => {
  it('un mixte de 20 questions se lit « 13 sur 20 », jamais sur 990', async () => {
    mockParams = { kind: 'mixed' };
    installer([def('m1', 'mixed', 1, 20, { meilleurScoreMax: 13 })]);
    await monter(<ListeTests />);
    expect(await screen.findByLabelText(/Meilleur : 13 sur 20/)).toBeTruthy();
    expect(screen.queryByText(/990/)).toBeNull();
  });

  it('un demi-test de lecture à 705 est ramené à 495, jamais « 705 sur 495 »', async () => {
    mockParams = { kind: 'reading' };
    installer([def('r1', 'reading', 1, 100, { meilleurScoreMax: 705 })]);
    await monter(<ListeTests />);
    expect((await screen.findAllByText(/495 sur 495/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/705/)).toBeNull();
  });
});

describe('statistiques : un score estimé seulement avec un diagnostic fait', () => {
  it('sans diagnostic, le chiffre du serveur n’est pas affiché à côté de « Pas encore »', async () => {
    const fausse = creerApiFausse({
      stats: {
        status: 'ok', periode: 7, reponsesTotal: 84, score: { estime: true, min: 620, max: 700, valeur: 660 },
        barres: [], tendance: 'up', parties: [], minutesSeances: 0, minutesLecture: 0, joursSur7: 0, seances: 0, serieJours: 0,
        mots: { aRevoir: 0, enCours: 0, connus: 0 }, calculeLe: '2026-10-16T09:00:00Z',
      },
      tentatives: [],
    });
    definirApi(fausse.api);
    await monter(<StatistiquesToeic />);
    expect(await screen.findByText(fr.certification.stats.courbe.pasEncore)).toBeTruthy();
    expect(screen.queryByText('660')).toBeNull();
  });
});

describe('pluriel : « 1 question »', () => {
  it('le singulier existe en français et en anglais', () => {
    expect(fr.certification.consignes.nombreUne).toBe('1 question dans cette partie.');
    expect(en.certification.consignes.nombreUne).toBe('1 question in this part.');
    expect(fr.certification.consignes.cartes.nombreUne).toBe('1 question dans cette partie');
  });
});
