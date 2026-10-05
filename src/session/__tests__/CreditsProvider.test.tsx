import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { definirConnectivitePourTest } from '@/services/connectivite';

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
  suivreSolde: (_c: unknown, _u: string, rappel: (l: unknown) => void) => {
    mockTempsReel = rappel;
    return mockArreter;
  },
}));
// Le provider passe par la dépense « avec repli hors ligne » (issue #13) : c'est ce point d'entrée qu'on pilote ici.
jest.mock('@/services/creditsHorsLigne', () => ({
  ...jest.requireActual('@/services/creditsHorsLigne'),
  depenserAvecRepli: (...a: unknown[]) => mockDepenser(...a),
}));

const solde = {
  total: 40, semaine: 40, recompenses: 0, recharge: 25, prochaineRecharge: '2026-10-04T23:00:00Z', rechargeHebdo: true,
  illimite: false, illimiteJusqua: null, expirationRecompenses: null,
};

function Sonde() {
  const { solde: s, couts, depenser, depensesEnAttente } = useCredits();
  return (
    <>
      <Text>{s ? `${s.total}${s.illimite ? ' illimité' : ''}` : 'chargement'}</Text>
      <Text>{`coût ${couts.exercise_solution ?? '-'}`}</Text>
      <Text>{`attente ${depensesEnAttente}`}</Text>
      <Pressable onPress={() => depenser('exercise_solution', 'ex-1')}><Text>dépenser</Text></Pressable>
    </>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTempsReel = null;
  mockSession.mockReturnValue({ session: { user: { id: 'u1', is_anonymous: false } } });
  mockLireSolde.mockResolvedValue(solde);
  // Par défaut l'app est en ligne : les tests qui veulent le hors ligne le déclarent explicitement.
  definirConnectivitePourTest({ connecte: true, internet: true, backend: true, enVerification: false });
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
    // La dépense passe par le repli hors ligne, avec le coût connu et le compte courant.
    expect(mockDepenser).toHaveBeenCalledWith(expect.objectContaining({ utilisateur: 'u1', action: 'exercise_solution', objet: 'ex-1', cout: 2 }));
    expect(screen.getByText('38')).toBeTruthy();
  });

  it('signale les dépenses faites hors ligne restées en attente', async () => {
    // Une opération en file : le solde affiché n'est pas encore confirmé par le serveur.
    await AsyncStorage.setItem('credits.depensesEnAttente.u1', JSON.stringify([{ id: 'op1', action: 'exercise_solution', objet: 'ex-1', cout: 2, le: '2026-10-05T10:00:00Z' }]));
    await render(<CreditsProvider><Sonde /></CreditsProvider>);
    await waitFor(() => expect(screen.getByText('attente 1')).toBeTruthy());
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
