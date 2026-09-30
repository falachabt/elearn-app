import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Updates from 'expo-updates';
import { AppState } from 'react-native';

import { estObligatoire, useMiseAJour } from '../miseAJour';

jest.mock('expo-updates', () => ({
  isEnabled: true,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));

const U = Updates as jest.Mocked<typeof Updates>;
const dispo = (manifest?: unknown) => U.checkForUpdateAsync.mockResolvedValue({ isAvailable: true, manifest } as never);

afterEach(() => jest.restoreAllMocks());

beforeEach(() => {
  U.checkForUpdateAsync.mockReset();
  U.fetchUpdateAsync.mockReset();
  U.reloadAsync.mockReset();
  U.fetchUpdateAsync.mockResolvedValue({ isNew: true } as never);
  U.reloadAsync.mockResolvedValue(undefined as never);
});

describe('estObligatoire', () => {
  it('lit le drapeau extra ou le message [obligatoire]', () => {
    expect(estObligatoire(undefined)).toBe(false);
    expect(estObligatoire({ extra: {} })).toBe(false);
    expect(estObligatoire({ extra: { obligatoire: true } })).toBe(true);
    expect(estObligatoire({ extra: { expoClient: { extra: { obligatoire: true } } } })).toBe(true);
    expect(estObligatoire({ metadata: { message: '[Obligatoire] correctif' } })).toBe(true);
    expect(estObligatoire({ metadata: { message: 'correctif [obligatoire]' } })).toBe(false);
  });
});

describe('useMiseAJour', () => {
  it('reste « aucune » sans mise à jour ou si désactivé', async () => {
    U.checkForUpdateAsync.mockResolvedValue({ isAvailable: false } as never);
    const { result } = await renderHook(() => useMiseAJour(true));
    await waitFor(() => expect(U.checkForUpdateAsync).toHaveBeenCalled());
    expect(result.current.etat).toBe('aucune');
    const off = await renderHook(() => useMiseAJour(false));
    expect(off.result.current.etat).toBe('aucune');
    expect(U.checkForUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it('disponible → téléchargement → prête, puis recharge', async () => {
    dispo();
    let fin!: () => void;
    U.fetchUpdateAsync.mockReturnValue(new Promise((ok) => { fin = () => ok({ isNew: true } as never); }));
    const { result } = await renderHook(() => useMiseAJour(true));
    await waitFor(() => expect(result.current.etat).toBe('disponible'));
    expect(result.current.obligatoire).toBe(false);
    let p!: Promise<void>;
    await act(async () => { p = result.current.installer(); });
    expect(result.current.etat).toBe('telechargement');
    await act(async () => { fin(); await p; });
    expect(result.current.etat).toBe('prete');
    expect(U.reloadAsync).toHaveBeenCalledTimes(1);
  });

  it('erreur au téléchargement puis nouvel essai réussi', async () => {
    dispo();
    U.fetchUpdateAsync.mockRejectedValueOnce(new Error('réseau'));
    const { result } = await renderHook(() => useMiseAJour(true));
    await waitFor(() => expect(result.current.etat).toBe('disponible'));
    await act(async () => { await result.current.installer(); });
    expect(result.current.etat).toBe('erreur');
    expect(result.current.erreur).toBe('réseau');
    expect(U.reloadAsync).not.toHaveBeenCalled();
    await act(async () => { await result.current.installer(); });
    expect(result.current.etat).toBe('prete');
    expect(U.reloadAsync).toHaveBeenCalledTimes(1);
  });

  it('une erreur de vérification reste silencieuse', async () => {
    U.checkForUpdateAsync.mockRejectedValue(new Error('hors ligne'));
    const { result } = await renderHook(() => useMiseAJour(true));
    await waitFor(() => expect(U.checkForUpdateAsync).toHaveBeenCalled());
    expect(result.current.etat).toBe('aucune');
    expect(result.current.visible).toBe(false);
  });

  it('plus tard masque jusqu’à la prochaine ouverture, même après un retour au premier plan', async () => {
    dispo();
    let ecouteur: (s: string) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, cb: (s: string) => void) => {
      ecouteur = cb;
      return { remove: jest.fn() };
    }) as never);
    const { result } = await renderHook(() => useMiseAJour(true));
    await waitFor(() => expect(result.current.visible).toBe(true));
    await act(async () => { result.current.plusTard(); });
    expect(result.current.visible).toBe(false);
    await act(async () => { ecouteur('active'); });
    await waitFor(() => expect(U.checkForUpdateAsync).toHaveBeenCalledTimes(2));
    expect(result.current.visible).toBe(false);
  });

  it('obligatoire : plus tard est sans effet', async () => {
    dispo({ extra: { obligatoire: true } });
    const { result } = await renderHook(() => useMiseAJour(true));
    await waitFor(() => expect(result.current.etat).toBe('disponible'));
    expect(result.current.obligatoire).toBe(true);
    await act(async () => { result.current.plusTard(); });
    expect(result.current.visible).toBe(true);
    expect(result.current.etat).toBe('disponible');
  });
});
