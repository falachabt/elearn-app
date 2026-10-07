import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { FormulaireCompte } from '../FormulaireCompte';

const mockConnecter = jest.fn();
const mockCreer = jest.fn();
const mockGoogle = jest.fn();

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false } }));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({}) }));
jest.mock('@/services/authNatif', () => ({ appleAffiche: false, facebookAffiche: false, depsOAuth: () => ({}), depsApple: () => ({}) }));
jest.mock('@/services/compte', () => ({
  ...jest.requireActual('@/services/compte'),
  creerCompteEmail: (...a: unknown[]) => mockCreer(...a),
  connecterEmail: (...a: unknown[]) => mockConnecter(...a),
  connecterGoogle: (...a: unknown[]) => mockGoogle(...a),
}));

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (mode: 'creer' | 'connexion') =>
  render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair"><FormulaireCompte mode={mode} /></ThemeProvider></SafeAreaProvider>);

const google = () => screen.getByRole('button', { name: fr.compte.google });
const connecter = () => screen.getByRole('button', { name: fr.compte.connecter });
const motDePasse = () => screen.getByLabelText(fr.compte.motDePasse);

beforeEach(() => {
  jest.clearAllMocks();
  mockGoogle.mockResolvedValue(undefined);
  mockConnecter.mockResolvedValue(undefined);
});

describe('formulaire de connexion : Google et e-mail restent séparés', () => {
  it('« Continuer avec Google » ne valide ni n’envoie le formulaire e-mail, champs vides', async () => {
    await monter('connexion');
    await fireEvent.press(google());
    await waitFor(() => expect(mockGoogle).toHaveBeenCalledTimes(1));
    expect(mockConnecter).not.toHaveBeenCalled();
    expect(screen.queryByText(fr.compte.erreurs.emailVide)).toBeNull();
    expect(screen.queryByText(fr.compte.erreurs.motDePasseVide)).toBeNull();
  });

  it('« Continuer avec Google » n’envoie pas un e-mail et un mot de passe déjà saisis', async () => {
    await monter('connexion');
    await fireEvent.changeText(screen.getByLabelText(fr.compte.email), 'amina@exemple.com');
    await fireEvent.changeText(motDePasse(), 'secret1234');
    await fireEvent.press(google());
    await waitFor(() => expect(mockGoogle).toHaveBeenCalledTimes(1));
    expect(mockConnecter).not.toHaveBeenCalled();
  });

  it('la touche Entrée dans le mot de passe envoie le formulaire e-mail, et lui seul', async () => {
    await monter('connexion');
    await fireEvent.changeText(screen.getByLabelText(fr.compte.email), 'amina@exemple.com');
    await fireEvent.changeText(motDePasse(), 'secret1234');
    await fireEvent(motDePasse(), 'submitEditing');
    await waitFor(() => expect(mockConnecter).toHaveBeenCalledTimes(1));
    expect(mockGoogle).not.toHaveBeenCalled();
  });

  it('« Me connecter » envoie le formulaire e-mail, et lui seul', async () => {
    await monter('connexion');
    await fireEvent.changeText(screen.getByLabelText(fr.compte.email), 'amina@exemple.com');
    await fireEvent.changeText(motDePasse(), 'secret1234');
    await fireEvent.press(connecter());
    await waitFor(() => expect(mockConnecter).toHaveBeenCalledTimes(1));
    expect(mockGoogle).not.toHaveBeenCalled();
  });

  it('un évènement de soumission arrivant pendant l’appui sur Google est ignoré (aucune validation, aucun envoi)', async () => {
    await monter('connexion');
    await fireEvent.changeText(screen.getByLabelText(fr.compte.email), 'amina@exemple.com');
    await fireEvent.changeText(motDePasse(), 'secret1234');
    await fireEvent(google(), 'pressIn');
    await fireEvent(motDePasse(), 'submitEditing');
    await fireEvent.press(connecter());
    expect(mockConnecter).not.toHaveBeenCalled();
    expect(screen.queryByText(fr.compte.erreurs.emailInvalide)).toBeNull();
  });

  it('pendant que Google est en cours, « Me connecter » et Entrée sont ignorés', async () => {
    let fin: () => void = () => {};
    mockGoogle.mockReturnValue(new Promise<void>((r) => { fin = r; }));
    await monter('connexion');
    await fireEvent.changeText(screen.getByLabelText(fr.compte.email), 'amina@exemple.com');
    await fireEvent.changeText(motDePasse(), 'secret1234');
    void fireEvent.press(google());
    await waitFor(() => expect(mockGoogle).toHaveBeenCalledTimes(1));
    await fireEvent.press(connecter());
    await fireEvent(motDePasse(), 'submitEditing');
    expect(mockConnecter).not.toHaveBeenCalled();
    fin();
  });

  it('pendant l’envoi e-mail, Google est grisé et ne part pas', async () => {
    let fin: () => void = () => {};
    mockConnecter.mockReturnValue(new Promise<void>((r) => { fin = r; }));
    await monter('connexion');
    await fireEvent.changeText(screen.getByLabelText(fr.compte.email), 'amina@exemple.com');
    await fireEvent.changeText(motDePasse(), 'secret1234');
    void fireEvent.press(connecter());
    await waitFor(() => expect(mockConnecter).toHaveBeenCalledTimes(1));
    await fireEvent.press(google());
    expect(mockGoogle).not.toHaveBeenCalled();
    fin();
  });

  it('création de compte : Google ne touche pas non plus au formulaire e-mail', async () => {
    await monter('creer');
    await fireEvent.press(google());
    await waitFor(() => expect(mockGoogle).toHaveBeenCalledTimes(1));
    expect(mockCreer).not.toHaveBeenCalled();
  });
});
