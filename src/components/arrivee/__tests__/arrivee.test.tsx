import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { changerLangue } from '@/i18n';
import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { calculerResultat, CLE_INVITATION, lireResultat, tirerMiniTest } from '@/services/miniTest';
import { enregistrerProfil, lireProfil } from '@/services/profil';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { DELAI_INVITATION_MS, Score } from '../Score';
import { MiniTest } from '../MiniTest';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) } }));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({ auth: { getSession: () => Promise.resolve({ data: { session: null } }) }, from: jest.fn() }) }));
jest.mock('@/services/authNatif', () => ({ appleAffiche: true, facebookAffiche: true, depsOAuth: () => ({}), depsApple: () => ({}) }));
const mockSession = jest.fn();
jest.mock('@/session/SessionProvider', () => ({ useSession: () => mockSession() }));
jest.mock('@gorhom/bottom-sheet', () => {
  const { forwardRef } = jest.requireActual<typeof import('react')>('react');
  const passe = forwardRef(function Feuille({ children }: { children?: React.ReactNode }, _ref: unknown) {
    return children ?? null;
  });
  return { __esModule: true, default: passe, BottomSheetView: ({ children }: { children?: React.ReactNode }) => children ?? null, BottomSheetModal: passe, BottomSheetModalProvider: ({ children }: { children?: React.ReactNode }) => children ?? null, BottomSheetBackdrop: () => null };
});
jest.mock('react-native-safe-area-context', () => {
  const actuel = jest.requireActual('react-native-safe-area-context');
  return { ...actuel, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

const invite = { statut: 'pret', session: { user: { id: 'u1', is_anonymous: true } }, erreur: null };
const membre = { statut: 'pret', session: { user: { id: 'u2', is_anonymous: false } }, erreur: null };
const monter = (n: React.ReactElement) => render(<ThemeProvider reglage="clair">{n}</ThemeProvider>);
const T = { fr, en };

// Choix mélangés de façon reproductible : on retrouve la bonne réponse par son texte.
const questions = tirerMiniTest('3e', () => 0.42);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockSession.mockReturnValue(invite);
  await enregistrerProfil({ type: 'eleve', niveau: '3e', pays: 'CM', termine: false });
});
afterAll(() => changerLangue('fr'));

describe.each(['fr', 'en'] as const)('A4 · mini-test (%s)', (langue) => {
  const x = T[langue];
  beforeEach(() => act(() => changerLangue(langue)));

  it('une question par écran : Valider inactif sans choix, correction, puis score enregistré', async () => {
    await monter(<MiniTest questions={questions} />);
    expect(screen.getByText(questions[0].enonce)).toBeTruthy();
    expect(screen.getByText('1/5')).toBeTruthy();
    const valider = screen.getByRole('button', { name: x.miniTest.valider });
    expect(valider).toBeDisabled();

    for (const [i, q] of questions.entries()) {
      // Première question fausse, les autres justes.
      const index = i === 0 ? (q.bonne + 1) % 4 : q.bonne;
      await fireEvent.press(screen.getByText(q.choix[index]));
      await fireEvent.press(screen.getByRole('button', { name: x.miniTest.valider }));
      expect(screen.getByText(i === 0 ? x.miniTest.rate : x.miniTest.bravo)).toBeTruthy();
      expect(screen.getByText(q.explication)).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: i === 4 ? x.miniTest.voirScore : x.miniTest.suivant }));
    }
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/score'));
    const r = await lireResultat();
    expect(r).toMatchObject({ score: 4, total: 5, niveau: '3e' });
    expect(r?.aRevoir?.chapitre).toBe(questions[0].chapitre);
  });

  it('fermer revient au choix du premier résultat', async () => {
    await monter(<MiniTest questions={questions} />);
    await fireEvent.press(screen.getByRole('button', { name: x.miniTest.fermer }));
    expect(router.replace).toHaveBeenCalledWith('/premier-resultat');
  });
});

describe.each(['fr', 'en'] as const)('A5 · score et A6 · sauvegarder (%s)', (langue) => {
  const x = T[langue];
  beforeEach(() => act(() => changerLangue(langue)));
  const bonnes = questions.map((q) => q.bonne);
  const reponses = [...bonnes];
  reponses[2] = (questions[2].bonne + 1) % 4;
  const resultat = calculerResultat(questions, reponses, { niveau: '3e', dureeS: 90 });

  it('score, point fort, point à revoir ; parcours terminé et événement envoyé', async () => {
    jest.useFakeTimers();
    try {
      await monter(<Score resultat={resultat} />);
      expect(screen.getByText('4/5')).toBeTruthy();
      expect(screen.getByText(x.score.pointFort)).toBeTruthy();
      expect(screen.getByText(resultat.pointFort!.chapitre)).toBeTruthy();
      expect(screen.getByText(x.score.aRevoir)).toBeTruthy();
      await waitFor(async () => expect((await lireProfil())?.termine).toBe(true));
      expect(suivre).toHaveBeenCalledWith('first_result_seen', { type: 'mini_test', duree_s: 90, score: 4, total: 5 });
      await act(async () => {
        jest.advanceTimersByTime(DELAI_INVITATION_MS + 10);
      });
      await waitFor(() => expect(suivre).toHaveBeenCalledWith('signup_prompt_seen', { source: 'score' }));
      expect(await AsyncStorage.getItem(CLE_INVITATION)).toBe('1');
    } finally {
      jest.useRealTimers();
    }
  });

  it('invité : proposer Google en premier ou continuer sans compte', async () => {
    await monter(<Score resultat={resultat} />);
    expect(screen.getByRole('button', { name: x.score.sauvegarder })).toBeTruthy();
    expect(screen.queryByRole('button', { name: x.score.continuer })).toBeNull();
    expect(screen.getByText(x.sauvegarde.titre)).toBeTruthy();
    expect(screen.getByRole('button', { name: x.compte.google })).toBeTruthy();
    expect(screen.getByRole('button', { name: x.score.continuerSansCompte })).toBeTruthy();
    for (const l of [x.compte.apple, x.compte.facebook, x.sauvegarde.email, x.sauvegarde.plusTard]) expect(screen.queryByRole('button', { name: l })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: x.score.voirLecon }));
    expect(router.replace).toHaveBeenCalledWith('/reviser');
  });

  it('invité : continuer sans compte ferme l’invitation et revient à l’accueil', async () => {
    await monter(<Score resultat={resultat} />);
    await fireEvent.press(screen.getByRole('button', { name: x.score.continuerSansCompte }));
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('invitation déjà vue : pas reproposée d’elle-même', async () => {
    jest.useFakeTimers();
    try {
      await AsyncStorage.setItem(CLE_INVITATION, '1');
      await monter(<Score resultat={resultat} />);
      await act(async () => {
        jest.advanceTimersByTime(DELAI_INVITATION_MS + 10);
      });
      expect(suivre).not.toHaveBeenCalledWith('signup_prompt_seen', expect.anything());
    } finally {
      jest.useRealTimers();
    }
  });

  it('compte déjà créé : pas d’invitation, bouton Continuer vers l’accueil', async () => {
    mockSession.mockReturnValue(membre);
    await monter(<Score resultat={resultat} />);
    expect(screen.queryByText(x.sauvegarde.titre)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: x.score.continuer }));
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('5/5 : message parfait et aucune erreur', async () => {
    await monter(<Score resultat={calculerResultat(questions, bonnes, { niveau: '3e', dureeS: 50 })} />);
    expect(screen.getByText(x.score.excellent)).toBeTruthy();
    expect(screen.getByText(x.score.toutJuste)).toBeTruthy();
  });
});
