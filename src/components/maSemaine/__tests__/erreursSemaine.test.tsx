import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { CLE_CORRECTION, oublierCorrectionEnMemoire } from '@/services/correction';
import { lireErreursSemaine, noterCorrection } from '@/services/erreursSemaine';
import type { QuestionTiree } from '@/services/miniTest';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { ErreursSemaine } from '../ErreursSemaine';

const t = fr.erreursSemaine;
let mockParams: Record<string, string | undefined> = { semaine: '2026-10-05' };

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), definirProprietesUtilisateur: jest.fn() }));
// Le quiz lui-même est testé ailleurs : ici on vérifie ce que l'écran lui passe et ce qu'il fait du résultat.
jest.mock('../../arrivee/MiniTest', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    ...jest.requireActual('../../arrivee/MiniTest'),
    MiniTest: ({ questions, onTermine }: { questions: { bonne: number }[]; onTermine: (p: unknown) => Promise<void> }) => (
      <Pressable accessibilityRole="button" onPress={() => void onTermine({ questions, reponses: questions.map((q, i) => (i === 0 ? q.bonne : 0)), dureeS: 5 })}>
        <Text>{`quiz ${questions.length}`}</Text>
      </Pressable>
    ),
  };
});

const q = (id: string): QuestionTiree => ({ id, matiere: 'maths', libelleMatiere: 'Maths', chapitre: 'Fractions', cours: null, enonce: `Question ${id} ?`, choix: ['A', 'B', 'C'], bonne: 1 } as QuestionTiree);
const metriques = { frame: { x: 0, y: 0, width: 360, height: 780 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (reglage: 'clair' | 'sombre' = 'clair') =>
  render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage={reglage}><ErreursSemaine /></ThemeProvider></SafeAreaProvider>);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  oublierCorrectionEnMemoire();
  mockParams = { semaine: '2026-10-05' };
});

describe('Mes erreurs de la semaine', () => {
  it.each(['clair', 'sombre'] as const)('liste chaque erreur de la semaine avec sa bonne réponse (%s)', async (reglage) => {
    await noterCorrection({ questions: [q('1'), q('2')], reponses: [0, 0] }, new Date(2026, 9, 7, 9));
    await noterCorrection({ questions: [q('hors')], reponses: [0] }, new Date(2026, 9, 14, 9));
    await monter(reglage);
    expect(await screen.findByText('Question 1 ?')).toBeTruthy();
    expect(screen.getByText('Question 2 ?')).toBeTruthy();
    expect(screen.queryByText('Question hors ?')).toBeNull();
    expect(screen.getByText('2 erreurs à revoir')).toBeTruthy();
    expect(screen.getAllByText(/Bonne réponse/)).toHaveLength(2);
    expect(screen.getByText(t.refairePlus.replace('{{n}}', '2'))).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('week_errors_viewed', { semaine: '2026-10-05', n: 2 });
  });

  it('refaire : les erreurs corrigées sortent de la liste, les autres restent, bilan affiché', async () => {
    await noterCorrection({ questions: [q('1'), q('2')], reponses: [0, 0] }, new Date(2026, 9, 7, 9));
    await monter();
    await fireEvent.press(await screen.findByText(t.refairePlus.replace('{{n}}', '2')));
    expect(screen.getByText('quiz 2')).toBeTruthy();
    // Le quiz simulé réussit la première question posée (la plus récente, « 2 ») seulement.
    await fireEvent.press(screen.getByRole('button'));
    expect(await screen.findByText('Question 1 ?')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Question 2 ?')).toBeNull());
    expect(screen.getByText('1 sur 2 corrigées')).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('week_errors_retried', { semaine: '2026-10-05', score: 1, total: 2 });
    expect((await lireErreursSemaine('2026-10-05')).map((e) => e.question.id)).toEqual(['1']);
  });

  it('semaine sans erreur enregistrée : message clair, et repli sur le dernier quiz s’il existe', async () => {
    await AsyncStorage.setItem(CLE_CORRECTION, JSON.stringify({ source: 'libre', questions: [q('9')], reponses: [0] }));
    await monter();
    expect(await screen.findByText(t.videTitre)).toBeTruthy();
    await fireEvent.press(screen.getByText(t.dernierQuiz));
    expect(router.push).toHaveBeenCalledWith('/mission/erreurs');
  });

  it('semaine sans erreur et sans quiz : pas de bouton de repli', async () => {
    await monter();
    expect(await screen.findByText(t.videTitre)).toBeTruthy();
    expect(screen.queryByText(t.dernierQuiz)).toBeNull();
  });
});
