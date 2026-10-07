import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AppState } from 'react-native';

import { CLE_DERNIERE_SEMAINE_VUE, semainePrecedente } from '@/services/maSemaine';

import { useOuvertureRecapAuto } from '../useOuvertureRecapAuto';

const mockRpc = jest.fn();
let mockPathname = '/';
let mockSession: { statut: string; session: { user: { is_anonymous: boolean } } | null } = { statut: 'pret', session: { user: { is_anonymous: false } } };
let mockReprise = false;

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  usePathname: () => mockPathname,
}));
jest.mock('@/session/SessionProvider', () => ({ useSession: () => mockSession }));
jest.mock('@/services/repriseInvite', () => ({ useRepriseInviteEnCours: () => mockReprise }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }) }));

const SEMAINE = semainePrecedente();
const BRUT = { semaine: SEMAINE, missions: 3, lecons_validees: 0, quiz_termines: 0, exercices_faits: 0, questions_ratees: 0, credits_utilises: 0, pass_actif: false, solde: 10, recharge_lundi: 25 };

let ecouteurAppState: ((e: string) => void) | null = null;

const membre = () => ({ statut: 'pret', session: { user: { is_anonymous: false } } });
const lancer = () => renderHook(() => useOuvertureRecapAuto());
const attendre = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockPathname = '/';
  mockSession = membre();
  mockReprise = false;
  mockRpc.mockResolvedValue({ data: BRUT, error: null });
  ecouteurAppState = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, f: (e: string) => void) => {
    ecouteurAppState = f;
    return { remove: jest.fn() };
  }) as never);
});

afterEach(() => jest.restoreAllMocks());

describe('ouverture automatique de « Ma semaine »', () => {
  it('s’ouvre au premier lancement de la semaine, sur l’accueil', async () => {
    await lancer();
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/ma-semaine', params: { semaine: SEMAINE, source: 'auto' } });
    expect(mockRpc).toHaveBeenCalledWith('my_week_recap', { p_semaine: SEMAINE });
  });

  it('ne s’ouvre pas si la semaine a déjà été vue', async () => {
    await AsyncStorage.setItem(CLE_DERNIERE_SEMAINE_VUE, SEMAINE);
    await lancer();
    await attendre();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('s’ouvre de nouveau la semaine suivante', async () => {
    await AsyncStorage.setItem(CLE_DERNIERE_SEMAINE_VUE, '2020-01-06');
    await lancer();
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
  });

  it('jamais pour un invité', async () => {
    mockSession = { statut: 'pret', session: { user: { is_anonymous: true } } };
    await lancer();
    await attendre();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('rien tant que la session n’est pas prête', async () => {
    mockSession = { statut: 'chargement', session: null };
    await lancer();
    await attendre();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('jamais pendant une mission, un quiz ou un paiement : on attend le retour sur l’accueil', async () => {
    mockPathname = '/mission';
    const { rerender } = await lancer();
    await attendre();
    expect(mockRpc).not.toHaveBeenCalled();
    mockPathname = '/offres/payer';
    await rerender({});
    await attendre();
    expect(mockRpc).not.toHaveBeenCalled();
    mockPathname = '/';
    await rerender({});
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
  });

  it('pas pendant la reprise de la progression d’un invité', async () => {
    mockReprise = true;
    await lancer();
    await attendre();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('rien quand il n’y a pas de récap (pas d’activité, invité côté serveur)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await lancer();
    await waitFor(() => expect(mockRpc).toHaveBeenCalled());
    await attendre();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('rien sans réseau : pas de page d’erreur au lancement', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { name: 'TypeError', message: 'Network request failed' } });
    await lancer();
    await waitFor(() => expect(mockRpc).toHaveBeenCalled());
    await attendre();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('une seule vérification par lancement : un rendu de plus ne rouvre rien', async () => {
    const { rerender } = await lancer();
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    await rerender({});
    await rerender({});
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it('reprise après plus de 30 minutes : revérifie, et rouvre si la semaine n’a pas été vue', async () => {
    const maintenant = jest.spyOn(Date, 'now');
    maintenant.mockReturnValue(1_000_000);
    await lancer();
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    await act(async () => {
      ecouteurAppState?.('background');
    });
    maintenant.mockReturnValue(1_000_000 + 31 * 60 * 1000);
    await act(async () => {
      ecouteurAppState?.('active');
    });
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(2));
  });

  it('reprise après 5 minutes seulement : aucune vérification', async () => {
    const maintenant = jest.spyOn(Date, 'now');
    maintenant.mockReturnValue(1_000_000);
    await lancer();
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    await act(async () => {
      ecouteurAppState?.('background');
    });
    maintenant.mockReturnValue(1_000_000 + 5 * 60 * 1000);
    await act(async () => {
      ecouteurAppState?.('active');
    });
    await attendre();
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it('reprise après 31 minutes mais semaine vue entre-temps : ne rouvre pas', async () => {
    const maintenant = jest.spyOn(Date, 'now');
    maintenant.mockReturnValue(1_000_000);
    await lancer();
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
    await AsyncStorage.setItem(CLE_DERNIERE_SEMAINE_VUE, SEMAINE);
    await act(async () => {
      ecouteurAppState?.('background');
    });
    maintenant.mockReturnValue(1_000_000 + 31 * 60 * 1000);
    await act(async () => {
      ecouteurAppState?.('active');
    });
    await attendre();
    expect(router.push).toHaveBeenCalledTimes(1);
  });
});
