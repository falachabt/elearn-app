import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { fr } from '@/i18n/fr';
import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import { deconnecter } from '@/services/compte';
import { enregistrerProfil } from '@/services/profil';

import { MoiToeic } from '../MoiToeic';
import { monter } from './harnais';

const t = fr.certification;

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), definirProprietesUtilisateur: jest.fn(), drapeauActif: jest.fn(() => true), ecouterDrapeaux: jest.fn(() => () => {}) }));
jest.mock('../../credits/CompteurCredits', () => ({ CompteurCredits: () => null }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({}) }));
jest.mock('@/services/compte', () => ({
  ...jest.requireActual<typeof import('@/services/compte')>('@/services/compte'),
  deconnecter: jest.fn(async () => {}),
}));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: true });
  definirApi(creerApiFausse().api);
});
afterEach(() => definirApi(null));

describe('N2 · Moi TOEIC', () => {
  it('la déconnexion demande une confirmation avant de sortir', async () => {
    await monter(<MoiToeic />);
    await fireEvent.press(await screen.findByText(t.moiToeic.deconnexion));
    expect(await screen.findByText(t.moiToeic.deconnexionTitre)).toBeTruthy();
    expect(deconnecter).not.toHaveBeenCalled();
  });

  it('« Annuler » ferme la confirmation sans se déconnecter', async () => {
    await monter(<MoiToeic />);
    await fireEvent.press(await screen.findByText(t.moiToeic.deconnexion));
    await fireEvent.press(screen.getByRole('button', { name: t.moiToeic.deconnexionAnnuler }));
    expect(screen.queryByText(t.moiToeic.deconnexionTitre)).toBeNull();
    expect(deconnecter).not.toHaveBeenCalled();
  });

  it('confirmer déconnecte puis renvoie à l’accueil de connexion', async () => {
    await monter(<MoiToeic />);
    await fireEvent.press(await screen.findByText(t.moiToeic.deconnexion));
    await fireEvent.press(screen.getByRole('button', { name: t.moiToeic.deconnexionBouton }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/bienvenue'));
    expect(deconnecter).toHaveBeenCalledTimes(1);
  });

  it('affiche la progression vers l’objectif, sans points XP', async () => {
    await monter(<MoiToeic />);
    expect(await screen.findByText(t.moiToeic.progressionEtiquette)).toBeTruthy();
    expect(screen.queryByText(/XP/)).toBeNull();
  });
});
