import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { changerLangue, i18n, restaurerLangue } from '@/i18n';
import { CLE_PARRAINAGE, conserverCode } from '@/services/parrainage';
import { lireProfil } from '@/services/profil';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { EcranMoi } from '../EcranMoi';
import { FormulaireCompte } from '../FormulaireCompte';
import { Bienvenue, ChoixClasse, PremierResultat } from '../ParcoursArrivee';

const mockSession = jest.fn();
const mockCreer = jest.fn();
const mockConnecter = jest.fn();
const mockDeconnecter = jest.fn();
const mockFacebook = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useLocalSearchParams: () => ({ type: 'eleve' }),
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({}) }));
jest.mock('@/services/authNatif', () => ({ appleAffiche: true, facebookAffiche: true, depsOAuth: () => ({}), depsApple: () => ({}) }));
jest.mock('@/session/SessionProvider', () => ({ useSession: () => mockSession() }));
jest.mock('@/services/compte', () => ({
  ...jest.requireActual('@/services/compte'),
  creerCompteEmail: (...a: unknown[]) => mockCreer(...a),
  connecterEmail: (...a: unknown[]) => mockConnecter(...a),
  deconnecter: (...a: unknown[]) => mockDeconnecter(...a),
  connecterGoogle: jest.fn(),
  connecterFacebook: (...a: unknown[]) => mockFacebook(...a),
  connecterApple: jest.fn(),
}));

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (n: React.ReactElement) =>
  render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair">{n}</ThemeProvider></SafeAreaProvider>);

const invite = { statut: 'pret', session: { user: { id: 'u1', is_anonymous: true } }, erreur: null };
const membre = { statut: 'pret', session: { user: { id: 'u2', is_anonymous: false, email: 'amina@exemple.com' } }, erreur: null };

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockSession.mockReturnValue(invite);
  mockCreer.mockResolvedValue({ etat: 'cree', conversionInvite: true });
});
afterEach(async () => {
  await act(() => changerLangue('fr'));
});

const T = {
  fr: { creer: 'Créer mon compte', email: 'Adresse e-mail', mdp: 'Mot de passe', emailInvalide: /semble incorrecte/, court: /au moins 8 caractères/, code: 'Code de parrainage (facultatif)', codeInvalide: /pas valable/, invite: 'Invité', lien: 'Me déconnecter', connecte: 'Compte sauvegardé' },
  en: { creer: 'Create my account', email: 'Email address', mdp: 'Password', emailInvalide: /looks wrong/, court: /at least 8 characters/, code: 'Referral code (optional)', codeInvalide: /not valid/, invite: 'Guest', lien: 'Sign out', connecte: 'Account saved' },
};

describe.each(['fr', 'en'] as const)('FormulaireCompte (%s)', (langue) => {
  const x = T[langue];
  beforeEach(() => act(() => changerLangue(langue)));

  it('affiche des erreurs lisibles sous chaque champ et n’appelle pas Supabase', async () => {
    await monter(<FormulaireCompte mode="creer" />);
    await fireEvent.changeText(screen.getByLabelText(x.email), 'pas-un-email');
    await fireEvent.changeText(screen.getByLabelText(x.mdp), '123');
    await fireEvent.changeText(screen.getByLabelText(x.code), 'a;b');
    await fireEvent.press(screen.getByRole('button', { name: x.creer }));
    expect(screen.getByText(x.emailInvalide)).toBeTruthy();
    expect(screen.getByText(x.court)).toBeTruthy();
    expect(screen.getByText(x.codeInvalide)).toBeTruthy();
    expect(mockCreer).not.toHaveBeenCalled();
  });

  it('crée le compte (conversion invité) avec le code saisi, le mémorise puis va sur Moi', async () => {
    await monter(<FormulaireCompte mode="creer" />);
    await fireEvent.changeText(screen.getByLabelText(x.email), 'amina@exemple.com');
    await fireEvent.changeText(screen.getByLabelText(x.mdp), 'motdepasse1');
    await fireEvent.changeText(screen.getByLabelText(x.code), 'abc123');
    await fireEvent.press(screen.getByRole('button', { name: x.creer }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/moi'));
    expect(mockCreer).toHaveBeenCalledWith({}, { email: 'amina@exemple.com', motDePasse: 'motdepasse1', codeParrainage: 'abc123' });
    expect(await lireProfil()).toMatchObject({ termine: true });
    expect(await AsyncStorage.getItem(CLE_PARRAINAGE)).toBeNull(); // code consommé
  });

  it('préremplit le code de parrainage reçu par lien (moins de 7 jours)', async () => {
    await conserverCode('amina24', 'lien');
    await monter(<FormulaireCompte mode="creer" />);
    await waitFor(() => expect(screen.getByLabelText(x.code).props.value).toBe('AMINA24'));
  });

  it('erreur serveur : message lisible dans une bannière, jamais le texte technique', async () => {
    mockCreer.mockRejectedValue({ code: 'email_exists', message: 'duplicate key value violates' });
    await monter(<FormulaireCompte mode="creer" />);
    await fireEvent.changeText(screen.getByLabelText(x.email), 'amina@exemple.com');
    await fireEvent.changeText(screen.getByLabelText(x.mdp), 'motdepasse1');
    await fireEvent.press(screen.getByRole('button', { name: x.creer }));
    await waitFor(() => expect(screen.getByText(langue === 'fr' ? /existe déjà/ : /already exists/)).toBeTruthy());
    expect(screen.queryByText(/duplicate key/)).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('connexion : pas de champ de code, appelle connecterEmail', async () => {
    mockConnecter.mockResolvedValue({});
    await monter(<FormulaireCompte mode="connexion" />);
    expect(screen.queryByLabelText(x.code)).toBeNull();
    // Connexion par numéro coupée : les anciens comptes passent par Google.
    expect(screen.getByText(langue === 'fr' ? /même compte Google/ : /same Google account/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: langue === 'fr' ? 'J’avais un compte avec mon numéro' : /phone number/ })).toBeNull();
    await fireEvent.changeText(screen.getByLabelText(x.email), 'amina@exemple.com');
    await fireEvent.changeText(screen.getByLabelText(x.mdp), 'motdepasse1');
    await fireEvent.press(screen.getByRole('button', { name: langue === 'fr' ? 'Me connecter' : 'Sign in' }));
    await waitFor(() => expect(mockConnecter).toHaveBeenCalledWith({}, { email: 'amina@exemple.com', motDePasse: 'motdepasse1' }));
  });

  it('Google, Apple (iOS) et Facebook (une fois activé) sont proposés', async () => {
    mockFacebook.mockResolvedValue(undefined);
    await monter(<FormulaireCompte mode="creer" />);
    expect(screen.getByRole('button', { name: langue === 'fr' ? 'Continuer avec Google' : 'Continue with Google' })).toBeTruthy();
    expect(screen.getByRole('button', { name: langue === 'fr' ? 'Continuer avec Apple' : 'Continue with Apple' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: langue === 'fr' ? 'Continuer avec Facebook' : 'Continue with Facebook' }));
    await waitFor(() => expect(mockFacebook).toHaveBeenCalled());
  });
});

describe.each(['fr', 'en'] as const)('EcranMoi (%s)', (langue) => {
  const x = T[langue];
  beforeEach(() => act(() => changerLangue(langue)));

  it('invité : état du compte et actions de création ou connexion', async () => {
    await monter(<EcranMoi />);
    expect(screen.getByText(x.invite)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: langue === 'fr' ? 'Créer un compte' : 'Create an account' }));
    expect(router.push).toHaveBeenCalledWith('/compte/creer');
    expect(screen.queryByRole('button', { name: x.lien })).toBeNull();
  });

  it('compte sauvegardé : e-mail affiché et déconnexion', async () => {
    mockSession.mockReturnValue(membre);
    mockDeconnecter.mockResolvedValue(undefined);
    await monter(<EcranMoi />);
    expect(screen.getByText(x.connecte)).toBeTruthy();
    expect(screen.getByText(/amina@exemple\.com/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: x.lien }));
    await waitFor(() => expect(mockDeconnecter).toHaveBeenCalled());
  });
});

describe('langue fr/en mémorisée', () => {
  it('le choix dans Moi est enregistré et restauré au redémarrage', async () => {
    await monter(<EcranMoi />);
    await fireEvent.press(screen.getByRole('button', { name: 'English' }));
    await waitFor(async () => expect(await AsyncStorage.getItem('langue')).toBe('en'));
    expect(screen.getByText('Guest')).toBeTruthy();
    await act(() => i18n.changeLanguage('fr'));
    let restauree;
    await act(async () => {
      restauree = await restaurerLangue();
    });
    expect(restauree).toBe('en');
    expect(i18n.language).toBe('en');
  });
});

describe.each(['fr', 'en'] as const)('parcours d’arrivée (%s)', (langue) => {
  beforeEach(() => act(() => changerLangue(langue)));

  it('A1 : deux choix sans compte, « déjà un compte » mène à la connexion', async () => {
    await monter(<Bienvenue />);
    await fireEvent.press(screen.getByRole('button', { name: langue === 'fr' ? 'Je suis élève' : 'I’m a student' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/classe', params: { type: 'eleve' } });
    await fireEvent.press(screen.getByRole('button', { name: langue === 'fr' ? 'J’ai déjà un compte' : 'I already have an account' }));
    expect(router.push).toHaveBeenCalledWith('/compte/connexion');
  });

  it('A2 : classe 3e et pays présélectionnés, enregistrés à Continuer', async () => {
    await monter(<ChoixClasse />);
    expect(screen.getByRole('button', { name: '3e' }).props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: '5e' }));
    await fireEvent.press(screen.getByRole('button', { name: langue === 'fr' ? 'Continuer' : 'Continue' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/premier-resultat'));
    expect(await lireProfil()).toEqual({ type: 'eleve', niveau: '5e', pays: 'CM', termine: false });
  });

  it('A3 : explorer termine le parcours et ouvre les onglets', async () => {
    await monter(<PremierResultat />);
    await fireEvent.press(screen.getByRole('button', { name: langue === 'fr' ? 'Explorer sans commencer' : 'Explore without starting' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect((await lireProfil())?.termine).toBe(true);
  });
});
