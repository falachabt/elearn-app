import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { CreditsProvider, useCredits } from '../CreditsProvider';

const mockSession = jest.fn();
const mockLireSolde = jest.fn();
const mockDepenser = jest.fn();
let mockTempsReel: ((ligne: unknown) => void) | null = null;
const mockArreter = jest.fn();

jest.mock('../SessionProvider', () => ({ useSession: () => mockSession() }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({}) }));
jest.mock('@/services/credits', () => ({
  ...jest.requireActual('@/services/credits'),
  identifiantAppareil: async () => 'android:test',
  lireSolde: (...a: unknown[]) => mockLireSolde(...a),
  lireCouts: async () => ({ exercise_solution: 2 }),
  depenser: (...a: unknown[]) => mockDepenser(...a),
  suivreSolde: (_c: unknown, _u: string, rappel: (l: unknown) => void) => {
    mockTempsReel = rappel;
    return mockArreter;
  },
}));

const solde = {
  total: 40, semaine: 40, recompenses: 0, recharge: 25, prochaineRecharge: '2026-10-04T23:00:00Z', rechargeHebdo: true,
  illimite: false, illimiteJusqua: null, expirationRecompenses: null,
};

function Sonde() {
  const { solde: s, couts, depenser } = useCredits();
  return (
    <>
      <Text>{s ? `${s.total}${s.illimite ? ' illimité' : ''}` : 'chargement'}</Text>
      <Text>{`coût ${couts.exercise_solution ?? '-'}`}</Text>
      <Pressable onPress={() => depenser('exercise_solution', 'ex-1')}><Text>dépenser</Text></Pressable>
    </>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTempsReel = null;
  mockSession.mockReturnValue({ session: { user: { id: 'u1', is_anonymous: false } } });
  mockLireSolde.mockResolvedValue(solde);
});

describe('CreditsProvider', () => {
  it('charge le solde et les coûts avec l’empreinte de l’appareil', async () => {
    await render(<CreditsProvider><Sonde /></CreditsProvider>);
    await waitFor(() => expect(screen.getByText('40')).toBeTruthy());
    expect(screen.getByText('coût 2')).toBeTruthy();
    expect(mockLireSolde).toHaveBeenCalledWith({}, 'android:test');
  });

  it('suit le solde en temps réel', async () => {
    await render(<CreditsProvider><Sonde /></CreditsProvider>);
    await waitFor(() => expect(screen.getByText('40')).toBeTruthy());
    await act(async () => mockTempsReel?.({ weekly_left: 38, reward_left: 0, next_refill_at: 'x', unlimited_until: '2099-01-01T00:00:00Z' }));
    expect(screen.getByText('38 illimité')).toBeTruthy();
  });

  it('met le solde à jour dès la réponse de la dépense', async () => {
    mockDepenser.mockResolvedValue({ statut: 'spent', cout: 2, solde: 38, contenu: {} });
    await render(<CreditsProvider><Sonde /></CreditsProvider>);
    await waitFor(() => expect(screen.getByText('40')).toBeTruthy());
    await act(async () => fireEvent.press(screen.getByText('dépenser')));
    expect(mockDepenser).toHaveBeenCalledWith({}, 'exercise_solution', 'ex-1');
    expect(screen.getByText('38')).toBeTruthy();
  });

  it('sans session : rien n’est chargé', async () => {
    mockSession.mockReturnValue({ session: null });
    await render(<CreditsProvider><Sonde /></CreditsProvider>);
    expect(screen.getByText('chargement')).toBeTruthy();
    expect(mockLireSolde).not.toHaveBeenCalled();
  });

  it('relit le solde quand l’invité crée son compte (bonus de bienvenue)', async () => {
    mockSession.mockReturnValue({ session: { user: { id: 'u1', is_anonymous: true } } });
    const { rerender } = await render(<CreditsProvider><Sonde /></CreditsProvider>);
    await waitFor(() => expect(mockLireSolde).toHaveBeenCalledTimes(1));
    mockSession.mockReturnValue({ session: { user: { id: 'u1', is_anonymous: false } } });
    await rerender(<CreditsProvider><Sonde /></CreditsProvider>);
    await waitFor(() => expect(mockLireSolde).toHaveBeenCalledTimes(2));
    expect(mockArreter).toHaveBeenCalled();
  });
});
