import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { effacerRepriseInvite } from '@/services/repriseInvite';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { RepriseProgression } from '../RepriseProgression';

const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace, push: jest.fn(), back: jest.fn() };
const mockSecureStore = new Map<string, string>();

jest.mock('expo-router', () => ({
  // Objet stable, comme le vrai useRouter : une nouvelle identité à chaque rendu relancerait les effets.
  useRouter: () => mockRouter,
  usePathname: () => '/compte/reprise',
  router: { replace: (...a: unknown[]) => mockReplace(...a), push: jest.fn(), back: jest.fn() },
}));
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (cle: string, valeur: string) => mockSecureStore.set(cle, valeur)),
  getItemAsync: jest.fn(async (cle: string) => mockSecureStore.get(cle) ?? null),
  deleteItemAsync: jest.fn(async (cle: string) => void mockSecureStore.delete(cle)),
}));
const mockSession = { statut: 'pret', session: { user: { id: 'u1', is_anonymous: false, user_metadata: {} } }, erreur: null };
jest.mock('@/session/SessionProvider', () => ({
  // Objet stable, comme le vrai fournisseur : une nouvelle identité à chaque rendu relancerait les effets.
  useSession: () => mockSession,
}));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({ functions: { invoke: jest.fn() } }) }));

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const monter = () =>
  render(
    <SafeAreaProvider initialMetrics={metriques}>
      <ThemeProvider reglage="clair">
        <RepriseProgression />
      </ThemeProvider>
    </SafeAreaProvider>,
  );

const ERREUR_SESSION = 'La session nécessaire à la reprise n’est plus disponible. Reconnecte-toi et réessaie.';

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockSecureStore.clear();
  await effacerRepriseInvite();
});

/**
 * Issue #119 : l'écran de reprise ne doit jamais être un cul-de-sac. Jeton invité perdu (cas web après
 * la redirection OAuth) : l'erreur doit offrir une sortie réelle ; aucune reprise en attente : l'écran
 * ne doit même pas s'afficher.
 */
it('reprise en attente mais jeton invité perdu : l’erreur propose une vraie sortie, qui débloque', async () => {
  await AsyncStorage.setItem('compte.repriseInvite', JSON.stringify({ inviteId: 'inv1', etat: 'a-confirmer', compteId: 'u1' }));
  await monter();
  expect(await screen.findByText(ERREUR_SESSION)).toBeTruthy();
  fireEvent.press(screen.getByText('Continuer sans fusionner'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  expect(await AsyncStorage.getItem('compte.repriseInvite')).toBeNull();
});

it('aucune reprise en attente : retour silencieux à l’accueil, sans erreur', async () => {
  await monter();
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  expect(screen.queryByText(ERREUR_SESSION)).toBeNull();
});

it('reprise complète (état + jeton) : les deux choix sont proposés, aucune erreur', async () => {
  await AsyncStorage.setItem('compte.repriseInvite', JSON.stringify({ inviteId: 'inv1', etat: 'a-confirmer', compteId: 'u1' }));
  mockSecureStore.set('compte.repriseInvite.jeton', 'refresh-1');
  await monter();
  expect(await screen.findByText('Ajouter ces avancées à mon compte')).toBeTruthy();
  expect(screen.queryByText(ERREUR_SESSION)).toBeNull();
  expect(screen.queryByText('Continuer sans fusionner')).toBeNull();
});
