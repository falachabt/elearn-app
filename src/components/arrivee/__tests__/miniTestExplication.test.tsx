import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import type { QuestionTiree } from '@/services/miniTest';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { MiniTest } from '../MiniTest';

const mockDepenser = jest.fn();
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true } }));
jest.mock('@/session/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'u1', is_anonymous: false } } }) }));
jest.mock('@/session/CreditsProvider', () => ({
  useCredits: () => ({
    solde: { illimite: false, total: 12, recharge: 25, rechargeHebdo: true, prochaineRecharge: new Date(Date.now() + 86400000).toISOString() },
    reglages: { bienvenue: 40, invite: 5, recharge: 25 },
    couts: { quiz_explanation: 1 },
    depenser: (...a: unknown[]) => mockDepenser(...a),
    rafraichir: async () => {},
  }),
}));

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const question = (id: string, explication = ''): QuestionTiree => ({ id, matiere: 'maths', libelleMatiere: 'Maths', chapitre: 'Fractions', cours: null, enonce: 'Combien font 2/3 + 1/6 ?', choix: ['3/9', '1/2', '5/6', '3/6'], bonne: 2, explication });
const monter = (questions: QuestionTiree[], onTermine = jest.fn()) =>
  render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair"><MiniTest questions={questions} onTermine={onTermine} /></ThemeProvider></SafeAreaProvider>);

beforeEach(() => jest.clearAllMocks());

describe('K2b · explication payante pendant le quiz', () => {
  it('après la réponse : bouton « Voir l’explication » avec son coût, texte rendu après la dépense, gardé pour la correction', async () => {
    mockDepenser.mockResolvedValue({ statut: 'spent', cout: 1, solde: 11, contenu: { explanation: 'On met sur 6 : 4/6 + 1/6 = 5/6.' } });
    const onTermine = jest.fn();
    await monter([question('42')], onTermine);
    await fireEvent.press(screen.getByText('3/9'));
    await fireEvent.press(screen.getByText(fr.miniTest.valider));
    await fireEvent.press(await screen.findByRole('button', { name: new RegExp(`${fr.credits.actions.quiz_explanation}.*1 crédit`) }));
    expect(mockDepenser).toHaveBeenCalledWith('quiz_explanation', '42');
    expect(await screen.findByText('On met sur 6 : 4/6 + 1/6 = 5/6.')).toBeTruthy();
    await fireEvent.press(screen.getByText(fr.miniTest.voirScore));
    await waitFor(() => expect(onTermine).toHaveBeenCalled());
    expect(onTermine.mock.calls[0][0].questions[0].explication).toBe('On met sur 6 : 4/6 + 1/6 = 5/6.');
  });

  it('hors ligne : message qui rassure sur le solde', async () => {
    mockDepenser.mockRejectedValue(new Error('hors ligne'));
    await monter([question('42')]);
    await fireEvent.press(screen.getByText('1/2'));
    await fireEvent.press(screen.getByText(fr.miniTest.valider));
    await fireEvent.press(await screen.findByRole('button', { name: new RegExp(fr.credits.actions.quiz_explanation) }));
    await waitFor(() => expect(screen.getByText(fr.credits.explicationHorsLigne)).toBeTruthy());
  });

  it('question du mini-test d’arrivée (explication locale) : pas de bouton payant', async () => {
    await monter([question('6e-1', 'On multiplie par 2.')]);
    await fireEvent.press(screen.getByText('3/9'));
    await fireEvent.press(screen.getByText(fr.miniTest.valider));
    expect(await screen.findByText('On multiplie par 2.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: new RegExp(fr.credits.actions.quiz_explanation) })).toBeNull();
  });
});
