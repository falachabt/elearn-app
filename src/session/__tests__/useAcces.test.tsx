import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';

import { lireAcces } from '@/services/pass';
import { useAcces } from '../useAcces';

jest.mock('@/services/pass', () => ({ lireAcces: jest.fn() }));
jest.mock('@/services/supabase', () => ({ getSupabase: jest.fn(() => ({})) }));

const lireAccesSimule = lireAcces as jest.Mock;
let ecouteur: (etat: string) => void = () => {};

beforeEach(() => {
  jest.clearAllMocks();
  ecouteur = () => {};
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, cb: (etat: string) => void) => {
    ecouteur = cb;
    return { remove: jest.fn() };
  }) as never);
  lireAccesSimule.mockResolvedValue(null);
});

afterEach(() => jest.restoreAllMocks());

describe('useAcces', () => {
  it('lit my_access au montage', async () => {
    const { result } = await renderHook(() => useAcces('u1'));
    await waitFor(() => expect(lireAccesSimule).toHaveBeenCalledTimes(1));
    expect(result.current.acces).toBeNull();
  });

  it('re-lit my_access à chaque retour dans l’app (paiement parent sur le web entre-temps)', async () => {
    const acces = { offre: 'month', fin: '2026-12-01T00:00:00Z', source: 'parent_link' };
    lireAccesSimule.mockResolvedValueOnce(null).mockResolvedValueOnce(acces);
    const { result } = await renderHook(() => useAcces('u1'));
    await waitFor(() => expect(lireAccesSimule).toHaveBeenCalledTimes(1));
    expect(result.current.acces).toBeNull();
    await act(async () => {
      ecouteur('active');
    });
    await waitFor(() => expect(lireAccesSimule).toHaveBeenCalledTimes(2));
    expect(result.current.acces).toEqual(acces);
  });

  it('ignore les passages en arrière-plan', async () => {
    const { result } = await renderHook(() => useAcces('u1'));
    await waitFor(() => expect(lireAccesSimule).toHaveBeenCalledTimes(1));
    await act(async () => {
      ecouteur('background');
    });
    await act(async () => {
      ecouteur('inactive');
    });
    expect(lireAccesSimule).toHaveBeenCalledTimes(1);
    expect(result.current.acces).toBeNull();
  });

  it('sans utilisateur : aucune lecture, accès null', async () => {
    const { result } = await renderHook(() => useAcces(null));
    await waitFor(() => expect(result.current.acces).toBeNull());
    expect(lireAccesSimule).not.toHaveBeenCalled();
    await act(async () => {
      ecouteur('active');
    });
    expect(lireAccesSimule).not.toHaveBeenCalled();
  });

  it('re-lit quand l’utilisateur change', async () => {
    const { rerender } = await renderHook(({ u }: { u: string | null }) => useAcces(u), { initialProps: { u: 'u1' as string | null } });
    await waitFor(() => expect(lireAccesSimule).toHaveBeenCalledTimes(1));
    rerender({ u: 'u2' });
    await waitFor(() => expect(lireAccesSimule).toHaveBeenCalledTimes(2));
  });

  it('une erreur réseau donne un accès null sans planter', async () => {
    lireAccesSimule.mockRejectedValueOnce(new Error('reseau'));
    const { result } = await renderHook(() => useAcces('u1'));
    await waitFor(() => expect(lireAccesSimule).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.acces).toBeNull());
  });
});
