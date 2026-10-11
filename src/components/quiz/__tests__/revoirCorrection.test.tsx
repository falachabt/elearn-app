import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { CLE_CORRECTION } from '@/services/correction';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { RevoirCorrection } from '../RevoirCorrection';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }, useLocalSearchParams: () => ({ i: '0' }) }));
jest.mock('@/session/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'u1', is_anonymous: false } } }) }));
jest.mock('@/session/CreditsProvider', () => ({
  useCredits: () => ({ solde: null, reglages: null, couts: {}, depenser: jest.fn(), rafraichir: async () => {} }),
}));

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = () => render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair"><RevoirCorrection /></ThemeProvider></SafeAreaProvider>);
const q = (id: string) => ({ id, matiere: 'maths', libelleMatiere: null, chapitre: 'C', cours: null, enonce: `Question ${id} ?`, choix: ['A', 'B'], bonne: 1, explication: 'Parce que.' });

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(CLE_CORRECTION, JSON.stringify({ source: 'libre', reponses: [0, 1], questions: [q('a'), q('b')] }));
});

describe('revoir la correction : dernière question', () => {
  it('« Suivante » mène à la dernière question, où « Terminer » remplace « Suivante » et quitte', async () => {
    await monter();
    await screen.findByText('Question a ?');
    expect(screen.queryByRole('button', { name: fr.correction.terminer })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: fr.correction.suivante }));
    expect(await screen.findByText('Question b ?')).toBeTruthy();
    // Plus de bouton « Suivante » bloqué : on peut quitter.
    expect(screen.queryByRole('button', { name: fr.correction.suivante })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: fr.correction.terminer }));
    expect(router.back).toHaveBeenCalled();
  });

  it('« Précédente » reste disponible sur la dernière question', async () => {
    await monter();
    await screen.findByText('Question a ?');
    await fireEvent.press(screen.getByRole('button', { name: fr.correction.suivante }));
    await screen.findByText('Question b ?');
    await fireEvent.press(screen.getByRole('button', { name: fr.correction.precedente }));
    expect(await screen.findByText('Question a ?')).toBeTruthy();
  });
});
