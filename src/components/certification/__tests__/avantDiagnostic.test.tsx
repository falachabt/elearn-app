import AsyncStorage from '@react-native-async-storage/async-storage';
import { screen } from '@testing-library/react-native';

import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import { MOTS_TEST, REVISION_TEST, SEANCE_TEST } from '@/services/certification/__tests__/fixturesRevision';
import { ecrirePlan } from '@/services/certification/etat';
import { enregistrerProfil } from '@/services/profil';

import { AccueilToeic } from '../AccueilToeic';
import { MoiToeic } from '../MoiToeic';
import { ReviserToeic } from '../ReviserToeic';
import { StatistiquesToeic } from '../StatistiquesToeic';
import { TestsToeic } from '../TestsToeic';
import { monter } from './harnais';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => cb(), [cb]);
  },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), drapeauActif: jest.fn(() => true), ecouterDrapeaux: jest.fn(() => () => {}) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-avant' }));
jest.mock('../../credits/CompteurCredits', () => ({ CompteurCredits: () => null }));

/** Profil TOEIC arrivé (objectif et temps saisis) mais sans diagnostic terminé : aucun onglet ne doit planter. */
beforeEach(async () => {
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: false });
  await ecrirePlan({ exam: 'toeic', objectif: 800, dateTest: '2026-11-27', minutes: 20 });
  definirApi(creerApiFausse({ revision: REVISION_TEST, carnet: MOTS_TEST, seance: SEANCE_TEST }).api);
});

describe('Onglets TOEIC avant diagnostic terminé', () => {
  it('Accueil : Mon TOEIC avant diagnostic (S7), bouton « Commencer le diagnostic » présent', async () => {
    await monter(<AccueilToeic />);
    expect(await screen.findByText('Commence par le diagnostic')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Commencer le diagnostic' })).toBeTruthy();
  });

  it('Statistiques : état vide, pas d’erreur', async () => {
    await monter(<StatistiquesToeic />);
    expect(await screen.findByText(/Pas encore de statistiques/)).toBeTruthy();
  });

  it('Moi : objectif visible et estimation « Pas encore estimé »', async () => {
    await monter(<MoiToeic />);
    expect(await screen.findByText('Pas encore estimé')).toBeTruthy();
    expect(screen.getByText('Visé')).toBeTruthy();
  });

  it('Tests : mini-tests disponibles, score estimé « Pas encore »', async () => {
    await monter(<TestsToeic />);
    expect(await screen.findByText('Mini-tests')).toBeTruthy();
    expect(screen.getByText('Pas encore')).toBeTruthy();
  });

  it('Réviser : onglets Parcours, Parties, Cours, Carnet', async () => {
    await monter(<ReviserToeic />);
    expect(await screen.findByText('Parties 1 à 7')).toBeTruthy();
    expect(screen.getByText('Carnet de mots')).toBeTruthy();
  });
});
