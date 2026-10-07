import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { CLE_PROPOSITION } from '@/services/proposerNotifications';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { PropositionNotifications } from '../PropositionNotifications';

const t = fr.propositionNotifications;
const mockLire = jest.fn();
const mockDemander = jest.fn();
const mockJeton = jest.fn();
let mockInvite = false;

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() } }));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));
jest.mock('@/session/SessionProvider', () => ({ useSession: () => ({ session: { user: { is_anonymous: mockInvite } } }) }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({ rpc: jest.fn() }) }));
jest.mock('@/services/push', () => ({ enregistrerJetonPush: (...a: unknown[]) => mockJeton(...a) }));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => mockLire(),
  requestPermissionsAsync: () => mockDemander(),
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const passe = ({ children }: { children?: React.ReactNode }) => children ?? null;
  return { __esModule: true, default: passe, BottomSheetView: passe, BottomSheetModal: passe, BottomSheetModalProvider: passe, BottomSheetBackdrop: () => null };
});

const metriques = { frame: { x: 0, y: 0, width: 360, height: 780 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (ui = <PropositionNotifications source="fin_quiz" />) =>
  render(
    <SafeAreaProvider initialMetrics={metriques}>
      <ThemeProvider reglage="clair">{ui}</ThemeProvider>
    </SafeAreaProvider>,
  );
const attendre = () => new Promise((r) => setTimeout(r, 30));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockInvite = false;
  mockLire.mockResolvedValue({ granted: false, canAskAgain: true });
  mockDemander.mockResolvedValue({ granted: true });
  mockJeton.mockResolvedValue(true);
});

describe('proposition d’autoriser les notifications', () => {
  it('s’ouvre à la fin d’un quiz avec le texte de la feuille', async () => {
    await monter();
    expect(await screen.findByText(t.titre)).toBeTruthy();
    expect(screen.getByText(t.texte)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.autoriser })).toBeTruthy();
    expect(screen.getByRole('button', { name: t.plusTard })).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('notification_prompt_shown', { source: 'fin_quiz' });
  });

  it('la source suit l’écran qui la propose', async () => {
    await monter(<PropositionNotifications source="fin_chapitre" />);
    await screen.findByText(t.titre);
    expect(suivre).toHaveBeenCalledWith('notification_prompt_shown', { source: 'fin_chapitre' });
  });

  it('« Autoriser » : le téléphone demande, le jeton est donné, puis Paramètres, Notifications', async () => {
    await monter();
    await fireEvent.press(await screen.findByRole('button', { name: t.autoriser }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/parametres/notifications'));
    expect(mockDemander).toHaveBeenCalledTimes(1);
    expect(mockJeton).toHaveBeenCalledTimes(1);
    expect(suivre).toHaveBeenCalledWith('notification_prompt_answered', { choix: 'accepte' });
    expect(screen.queryByText(t.titre)).toBeNull();
  });

  it('refusé au téléphone : on arrive quand même sur Notifications, qui explique quoi faire', async () => {
    mockDemander.mockResolvedValue({ granted: false });
    await monter();
    await fireEvent.press(await screen.findByRole('button', { name: t.autoriser }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/parametres/notifications'));
    expect(mockJeton).not.toHaveBeenCalled();
    expect(suivre).toHaveBeenCalledWith('notification_prompt_answered', { choix: 'refuse' });
  });

  it('« Plus tard » : ferme sans rien demander au téléphone et note la date', async () => {
    await monter();
    await fireEvent.press(await screen.findByRole('button', { name: t.plusTard }));
    await waitFor(() => expect(screen.queryByText(t.titre)).toBeNull());
    expect(mockDemander).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(suivre).toHaveBeenCalledWith('notification_prompt_answered', { choix: 'plus_tard' });
    expect(JSON.parse((await AsyncStorage.getItem(CLE_PROPOSITION)) ?? '{}').statut).toBe('plus-tard');
  });

  it('après « Plus tard », rien avant 7 jours ; après 7 jours, elle revient', async () => {
    await AsyncStorage.setItem(CLE_PROPOSITION, JSON.stringify({ statut: 'plus-tard', le: new Date(Date.now() - 2 * 86400000).toISOString() }));
    await monter();
    await attendre();
    expect(screen.queryByText(t.titre)).toBeNull();
    await screen.unmount();
    await AsyncStorage.setItem(CLE_PROPOSITION, JSON.stringify({ statut: 'plus-tard', le: new Date(Date.now() - 8 * 86400000).toISOString() }));
    await monter();
    expect(await screen.findByText(t.titre)).toBeTruthy();
  });

  it('jamais pour un invité', async () => {
    mockInvite = true;
    await monter();
    await attendre();
    expect(screen.queryByText(t.titre)).toBeNull();
    expect(mockLire).not.toHaveBeenCalled();
  });

  it('pas quand la permission est déjà accordée ou refusée pour de bon', async () => {
    mockLire.mockResolvedValue({ granted: true, canAskAgain: true });
    await monter();
    await attendre();
    expect(screen.queryByText(t.titre)).toBeNull();
    await screen.unmount();
    mockLire.mockResolvedValue({ granted: false, canAskAgain: false });
    await monter();
    await attendre();
    expect(screen.queryByText(t.titre)).toBeNull();
  });

  it('attend quand l’écran hôte la désactive (une autre feuille est ouverte)', async () => {
    await monter(<PropositionNotifications source="fin_mission" actif={false} />);
    await attendre();
    expect(screen.queryByText(t.titre)).toBeNull();
    expect(mockLire).not.toHaveBeenCalled();
  });

  it('une seule fois par ouverture de l’écran', async () => {
    await monter();
    await screen.findByText(t.titre);
    expect((suivre as jest.Mock).mock.calls.filter((c) => c[0] === 'notification_prompt_shown')).toHaveLength(1);
  });
});
