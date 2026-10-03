import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { CLE_CORRECTION, lireCorrection } from '@/services/correction';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { RevoirCorrection } from '../RevoirCorrection';

const mockDepenser = jest.fn();
let mockPass = false;
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }, useLocalSearchParams: () => ({ i: '0' }) }));
jest.mock('@/session/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'u1', is_anonymous: false } } }) }));
jest.mock('@/session/CreditsProvider', () => ({
  useCredits: () => ({ solde: { illimite: mockPass, total: 0, recharge: 25, rechargeHebdo: true, prochaineRecharge: new Date(Date.now() + 86400000).toISOString() }, reglages: { bienvenue: 40, invite: 5, recharge: 25 }, couts: { quiz_explanation: 1 }, depenser: (...a: unknown[]) => mockDepenser(...a), rafraichir: async () => {} }),
}));

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = () => render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair"><RevoirCorrection /></ThemeProvider></SafeAreaProvider>);

beforeEach(async () => {
  jest.clearAllMocks();
  mockPass = false;
  await AsyncStorage.clear();
  await AsyncStorage.setItem(
    CLE_CORRECTION,
    JSON.stringify({ source: 'libre', reponses: [0], questions: [{ id: '42', matiere: 'logique', libelleMatiere: null, chapitre: 'C', cours: null, enonce: 'Q ?', choix: ['A', 'B'], bonne: 1, explication: '' }] }),
  );
});

describe('explication de quiz payante (M18-04)', () => {
  it('le bouton annonce le prix ; l’explication vient de depenser_credits et reste gardée', async () => {
    mockDepenser.mockResolvedValue({ statut: 'spent', cout: 1, solde: 9, contenu: { explanation: 'Parce que B.' } });
    await monter();
    const bouton = await screen.findByRole('button', { name: new RegExp(`${fr.payant.voirExplication}.*1 crédit`) });
    await fireEvent.press(bouton);
    expect(mockDepenser).toHaveBeenCalledWith('quiz_explanation', '42');
    await waitFor(() => expect(screen.getByText('Parce que B.')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /1 crédit/ })).toBeNull();
    expect((await lireCorrection())?.questions[0].explication).toBe('Parce que B.');
  });

  it('crédits insuffisants : rien d’affiché, le message dit ce qu’il manque', async () => {
    mockDepenser.mockResolvedValue({ statut: 'insufficient', cout: 1, solde: 0, contenu: null });
    await monter();
    await fireEvent.press(await screen.findByRole('button', { name: /1 crédit/ }));
    // Plus de crédits : on le dit simplement et « Recharger » ouvre les pass.
    await waitFor(() => expect(screen.getByText(fr.credits.rechargeTitre)).toBeTruthy());
    expect(screen.getByText(fr.credits.rechargeTexte)).toBeTruthy();
    await fireEvent.press(screen.getByText(fr.credits.recharger));
    expect(router.push).toHaveBeenCalledWith('/offres?declencheur=limite');
    expect(screen.queryByText('Parce que B.')).toBeNull();
  });

  it('panne réseau : message d’erreur, bouton toujours là', async () => {
    mockDepenser.mockRejectedValue(new Error('hors ligne'));
    await monter();
    await fireEvent.press(await screen.findByRole('button', { name: /1 crédit/ }));
    await waitFor(() => expect(screen.getByText(fr.credits.explicationHorsLigne)).toBeTruthy());
  });

  it('avec un pass : la justification s’ouvre automatiquement', async () => {
    mockPass = true;
    mockDepenser.mockResolvedValue({ statut: 'unlimited', cout: 0, solde: 0, contenu: { explanation: 'Parce que B.' } });
    await monter();
    expect(mockDepenser).toHaveBeenCalledWith('quiz_explanation', '42');
    expect(await screen.findByText('Parce que B.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /crédit/ })).toBeNull();
  });
});
