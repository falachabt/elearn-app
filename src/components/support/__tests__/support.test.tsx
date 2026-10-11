import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { AppState, Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { marquerMontree, oublierDemandesMontrees, type DemandeSupport } from '@/services/support';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { EcranConfirmerSupport } from '../EcranConfirmerSupport';
import { LienSupport } from '../LienSupport';
import { useDemandeSupportAuto } from '../useDemandeSupportAuto';

const mockSession = jest.fn();
const mockPush = jest.fn();
const mockPathname = jest.fn(() => '/');
const mockLire = jest.fn();
const mockRepondre = jest.fn();
const mockNotifs = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: (...a: unknown[]) => mockPush(...a) }),
  usePathname: () => mockPathname(),
}));
jest.mock('expo-notifications', () => ({ addNotificationReceivedListener: (f: unknown) => mockNotifs(f) }));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));
jest.mock('@/session/SessionProvider', () => ({ useSession: () => mockSession() }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({}) }));
jest.mock('@/services/support', () => ({
  ...jest.requireActual('@/services/support'),
  lireDemandesSupport: (...a: unknown[]) => mockLire(...a),
  repondreDemandeSupport: (...a: unknown[]) => mockRepondre(...a),
}));

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (n: React.ReactElement) => render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair">{n}</ThemeProvider></SafeAreaProvider>);
const membre = { statut: 'pret', session: { user: { id: 'u2', is_anonymous: false, email: 'amina@exemple.com', user_metadata: {} } } };
const invite = { statut: 'pret', session: { user: { id: 'u1', is_anonymous: true, user_metadata: {} } } };
const demande = (id = 'req-1'): DemandeSupport => ({ id, phone_hint: '0501', created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });

beforeEach(() => {
  jest.clearAllMocks();
  oublierDemandesMontrees();
  mockSession.mockReturnValue(membre);
  mockPathname.mockReturnValue('/');
  mockLire.mockResolvedValue([]);
  mockNotifs.mockReturnValue({ remove: jest.fn() });
  mockNotifs.mockImplementation(() => ({ remove: jest.fn() }));
  // Dans l'environnement de test, AppState ne renvoie pas d'abonnement : on en donne un.
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
});

describe('écran « Confirmer une demande du support »', () => {
  it('invité : invitation à se connecter, aucune lecture de demande', async () => {
    mockSession.mockReturnValue(invite);
    await monter(<EcranConfirmerSupport />);
    await waitFor(() => expect(screen.getByText(fr.support.invite)).toBeTruthy());
    expect(mockLire).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: fr.profil.dejaCompte }));
    expect(mockPush).toHaveBeenCalledWith('/compte/connexion');
  });

  it('aucune demande en attente : message clair', async () => {
    await monter(<EcranConfirmerSupport />);
    await waitFor(() => expect(screen.getByText(fr.support.aucune)).toBeTruthy());
  });

  it('une demande : les quatre derniers chiffres seulement, puis « Oui, c’est moi » confirme', async () => {
    mockLire.mockResolvedValue([demande()]);
    mockRepondre.mockResolvedValue('accepted');
    await monter(<EcranConfirmerSupport />);
    await waitFor(() => expect(screen.getByText(fr.support.demande.replace('{{fin}}', '0501'))).toBeTruthy());
    expect(screen.getByText(fr.support.question)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: fr.support.oui }));
    await waitFor(() => expect(screen.getByText(fr.support.accepte)).toBeTruthy());
    expect(mockRepondre).toHaveBeenCalledWith({}, 'req-1', true);
    expect(screen.getByText(fr.support.accepteSous)).toBeTruthy();
  });

  it('« Non, ce n’est pas moi » refuse et rassure', async () => {
    mockLire.mockResolvedValue([demande()]);
    mockRepondre.mockResolvedValue('refused');
    await monter(<EcranConfirmerSupport />);
    await waitFor(() => expect(screen.getByText(fr.support.non)).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: fr.support.non }));
    await waitFor(() => expect(screen.getByText(fr.support.refuse)).toBeTruthy());
    expect(mockRepondre).toHaveBeenCalledWith({}, 'req-1', false);
    expect(screen.getByText(fr.support.refuseSous)).toBeTruthy();
  });

  it('demande périmée : message d’expiration', async () => {
    mockLire.mockResolvedValue([demande()]);
    mockRepondre.mockResolvedValue('expiree');
    await monter(<EcranConfirmerSupport />);
    await waitFor(() => expect(screen.getByText(fr.support.oui)).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: fr.support.oui }));
    await waitFor(() => expect(screen.getByText(fr.support.expiree)).toBeTruthy());
  });

  it('erreur réseau : bannière, les boutons restent utilisables pour réessayer', async () => {
    mockLire.mockResolvedValue([demande()]);
    mockRepondre.mockResolvedValueOnce('erreur').mockResolvedValueOnce('accepted');
    await monter(<EcranConfirmerSupport />);
    await waitFor(() => expect(screen.getByText(fr.support.oui)).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: fr.support.oui }));
    await waitFor(() => expect(screen.getByText(fr.support.erreur)).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: fr.support.oui }));
    await waitFor(() => expect(screen.getByText(fr.support.accepte)).toBeTruthy());
    expect(mockRepondre).toHaveBeenCalledTimes(2);
  });
});

describe('ouverture automatique de l’écran', () => {
  it('compte connecté avec une demande en attente : l’écran s’ouvre, pas une deuxième fois une fois vue', async () => {
    let rappel: ((e: string) => void) | undefined;
    (AppState.addEventListener as jest.Mock).mockImplementation(((_t: string, f: (e: string) => void) => {
      rappel = f;
      return { remove: jest.fn() };
    }) as never);
    mockLire.mockResolvedValue([demande()]);
    await renderHook(() => useDemandeSupportAuto());
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/support-confirmer'));
    expect(mockPush).toHaveBeenCalledTimes(1);
    // L’écran l’a montrée : la demande est marquée comme vue, un retour au premier plan ne la rouvre pas.
    marquerMontree('req-1');
    mockPush.mockClear();
    await act(async () => rappel?.('active'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('retour au premier plan : relit les demandes', async () => {
    let rappel: ((e: string) => void) | undefined;
    const ecoute = (AppState.addEventListener as jest.Mock).mockImplementation(((_t: string, f: (e: string) => void) => {
      rappel = f;
      return { remove: jest.fn() };
    }) as never);
    await renderHook(() => useDemandeSupportAuto());
    await waitFor(() => expect(mockLire).toHaveBeenCalledTimes(1));
    mockLire.mockResolvedValue([demande('req-2')]);
    await act(async () => rappel?.('active'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/support-confirmer'));
    ecoute.mockReset();
  });

  it('notification reçue application ouverte : relit les demandes (seulement pour ce type)', async () => {
    let recue: ((n: unknown) => void) | undefined;
    mockNotifs.mockImplementation((f: (n: unknown) => void) => {
      recue = f;
      return { remove: jest.fn() };
    });
    await renderHook(() => useDemandeSupportAuto());
    await waitFor(() => expect(mockLire).toHaveBeenCalledTimes(1));
    await act(async () => recue?.({ request: { content: { data: { type: 'credits_refilled' } } } }));
    expect(mockLire).toHaveBeenCalledTimes(1);
    mockLire.mockResolvedValue([demande('req-3')]);
    await act(async () => recue?.({ request: { content: { data: { type: 'support_auth_request' } } } }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/support-confirmer'));
  });

  it('invité ou déjà sur l’écran : rien n’est ouvert', async () => {
    mockSession.mockReturnValue(invite);
    mockLire.mockResolvedValue([demande()]);
    await renderHook(() => useDemandeSupportAuto());
    await act(async () => {});
    expect(mockLire).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    mockSession.mockReturnValue(membre);
    mockPathname.mockReturnValue('/support-confirmer');
    await renderHook(() => useDemandeSupportAuto());
    await act(async () => {});
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('session pas prête ou aucune demande : rien n’est ouvert', async () => {
    mockSession.mockReturnValue({ ...membre, statut: 'chargement' });
    await renderHook(() => useDemandeSupportAuto());
    await act(async () => {});
    expect(mockLire).not.toHaveBeenCalled();
    mockSession.mockReturnValue(membre);
    await renderHook(() => useDemandeSupportAuto());
    await act(async () => {});
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('lien d’aide près des paiements', () => {
  it('ouvre le support WhatsApp avec un message prérempli contenant la référence', async () => {
    const ouvrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    await monter(<LienSupport reference="EP-2026-0001" />);
    await fireEvent.press(screen.getByRole('button', { name: fr.support.aidePaiement }));
    expect(ouvrir).toHaveBeenCalledTimes(1);
    const lien = String(ouvrir.mock.calls[0][0]);
    expect(lien.startsWith('https://wa.me/12015348324?text=')).toBe(true);
    expect(decodeURIComponent(lien)).toContain('EP-2026-0001');
    ouvrir.mockRestore();
  });

  it('sans référence : message correct quand même, et un échec d’ouverture ne plante pas', async () => {
    const ouvrir = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('aucune application') as never);
    await monter(<LienSupport />);
    await fireEvent.press(screen.getByRole('button', { name: fr.support.aidePaiement }));
    expect(decodeURIComponent(String(ouvrir.mock.calls[0][0]))).toContain('Référence : …');
    ouvrir.mockRestore();
  });
});
