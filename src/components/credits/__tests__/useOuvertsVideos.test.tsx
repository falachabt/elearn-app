// useOuverts pour les vidéos de cours (26/10/2026) : l'état d'une vidéo pour les cadenas et les pastilles
// de prix — payante par défaut, gratuite tant que la découverte n'est pas consommée, déjà débloquée
// (y compris par l'ancienneté, que my_unlocked_refs fusionne côté serveur), incluse avec un pass.
import { renderHook, waitFor } from '@testing-library/react-native';

import { useOuverts } from '../useOuverts';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => {
      useEffect(() => cb(), [cb]);
    },
  };
});

const mockCredits = jest.fn();
jest.mock('@/session/CreditsProvider', () => ({ useCredits: () => mockCredits() }));
jest.mock('@/session/SessionProvider', () => ({ useSessionPrete: () => 'pret' }));

const mockRpc = jest.fn();
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({ rpc: mockRpc }) }));

const V1 = '00000000-0000-0000-0000-00000000d101';
const V2 = '00000000-0000-0000-0000-00000000d102';

function donnerCredits(illimite = false) {
  mockCredits.mockReturnValue({
    solde: { total: 40, semaine: 40, recompenses: 0, illimite, illimiteJusqua: illimite ? '2026-11-12T00:00:00Z' : null },
    couts: { course_video: 3 },
  });
}

function donnerServeur(ouverts: string[], gratuites: number) {
  mockRpc.mockImplementation(async (nom: string) => {
    if (nom === 'my_unlocked_refs') return { data: ouverts, error: null };
    if (nom === 'my_free_videos_left') return { data: gratuites, error: null };
    return { data: null, error: null };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  donnerCredits();
  donnerServeur([], 0);
});

describe('useOuverts course_video', () => {
  it('vidéo neuve, découverte consommée : payante', async () => {
    const { result } = await renderHook(() => useOuverts('course_video', [V1, V2]));
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('my_free_videos_left'));
    expect(result.current.etat(V1)).toBe('payant');
    expect(result.current.sansFrais(V1)).toBe(false);
    expect(result.current.cout).toBe(3);
  });

  it('découverte encore disponible : gratuite, sans frais', async () => {
    donnerServeur([], 1);
    const { result } = await renderHook(() => useOuverts('course_video', [V1]));
    await waitFor(() => expect(result.current.gratuits).toBe(1));
    expect(result.current.etat(V1)).toBe('gratuit');
    expect(result.current.sansFrais(V1)).toBe(true);
  });

  it('vidéo déjà débloquée (ou regardée avant les crédits) : déjà, sans frais', async () => {
    donnerServeur([V1], 0);
    const { result } = await renderHook(() => useOuverts('course_video', [V1, V2]));
    await waitFor(() => expect(result.current.deja(V1)).toBe(true));
    expect(result.current.etat(V1)).toBe('deja');
    expect(result.current.sansFrais(V1)).toBe(true);
    expect(result.current.etat(V2)).toBe('payant');
  });

  it('pass illimité : incluse, sans frais, même sans déblocage', async () => {
    donnerCredits(true);
    const { result } = await renderHook(() => useOuverts('course_video', [V1]));
    await waitFor(() => expect(mockRpc).toHaveBeenCalled());
    expect(result.current.etat(V1)).toBe('inclus');
    expect(result.current.sansFrais(V1)).toBe(true);
  });
});
