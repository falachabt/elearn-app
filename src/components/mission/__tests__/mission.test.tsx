import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { changerLangue } from '@/i18n';
import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { CLE_DERNIER, CLE_HISTORIQUE, jourLocal, type LigneMission } from '@/services/mission';
import { enregistrerProfil } from '@/services/profil';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { Accueil, titreMission } from '../Accueil';
import { FinMission } from '../FinMission';
import { Mission } from '../Mission';

const mockRpc = jest.fn();
const mockInsert = jest.fn(() => Promise.resolve({ error: null }));
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) },
  useFocusEffect: (f: () => void | (() => void)) => {
    const { useEffect: effet } = jest.requireActual('react');
    effet(f, [f]);
  },
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a), from: () => ({ insert: mockInsert }) }) }));

const ligne = (i: number, sujet = 'Maths'): LigneMission => ({
  question_id: i,
  quiz_id: `q${i}`,
  chapter: `Chapitre ${i}`,
  subject: sujet,
  kind: 'select',
  prompt: `Question ${i} ?`,
  options: [
    { id: 'a', text: `Bonne ${i}` },
    { id: 'b', text: `Fausse ${i}` },
  ],
  correct: ['a'],
  explanation: 'Explication.',
});
const LIGNES = [ligne(1), ligne(2, 'Chimie'), ligne(3), ligne(4), ligne(5)];

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (el: React.ReactElement) =>
  render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair">{el}</ThemeProvider></SafeAreaProvider>);
const T = { fr, en };
const SOIR = new Date(2026, 9, 1, 20, 0);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'eleve', niveau: '3e', pays: 'CM', termine: true });
  mockRpc.mockResolvedValue({ data: LIGNES, error: null });
});
afterAll(() => changerLangue('fr'));

it('titre de la carte : deux premiers chapitres', () => {
  expect(titreMission(null)).toBeNull();
  expect(titreMission({ jour: 'x', source: 'serveur', questions: [{ chapitre: 'A' }, { chapitre: 'A' }, { chapitre: 'B' }, { chapitre: 'C' }] as never })).toBe('A, B');
});

describe.each(['fr', 'en'] as const)('C1 à C3 · mission du jour (%s)', (langue) => {
  const x = T[langue];
  beforeEach(() => act(() => changerLangue(langue)));

  it('accueil : salutation du soir, chapitres et matières de la mission, commencer en 1 appui', async () => {
    await AsyncStorage.setItem(CLE_HISTORIQUE, JSON.stringify(['2026-09-29', '2026-09-30']));
    await monter(<Accueil maintenant={SOIR} />);
    expect(screen.getByText(x.mission.bonsoir)).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Chapitre 1, Chapitre 2')).toBeTruthy());
    expect(screen.getByText('Chimie')).toBeTruthy();
    expect(screen.getByLabelText(x.mission.serieLibelle.replace('{{n}}', '2'))).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledWith('daily_mission', expect.objectContaining({ p_level: '3e', p_country: 'CM', p_day: '2026-10-01' }));
    await fireEvent.press(screen.getByRole('button', { name: x.mission.commencer }));
    expect(router.push).toHaveBeenCalledWith('/mission');
  });

  it('accueil : mission déjà faite aujourd’hui', async () => {
    await AsyncStorage.setItem(CLE_DERNIER, JSON.stringify({ jour: '2026-10-01', score: 4, total: 5, chapitres: [], serie: 1 }));
    await monter(<Accueil maintenant={SOIR} />);
    await waitFor(() => expect(screen.getByText(x.mission.faite)).toBeTruthy());
    expect(screen.getByRole('button', { name: x.mission.refaire })).toBeTruthy();
  });

  it('mission : 5 questions, correction, puis fin enregistrée', async () => {
    await monter(<Mission />);
    await waitFor(() => expect(screen.getByText('Question 1 ?')).toBeTruthy());
    expect(suivre).toHaveBeenCalledWith('mission_started', { source: 'serveur', total: 5 });
    for (let i = 1; i <= 5; i++) {
      await fireEvent.press(screen.getByText(i === 2 ? `Fausse ${i}` : `Bonne ${i}`));
      await fireEvent.press(screen.getByRole('button', { name: x.miniTest.valider }));
      await fireEvent.press(screen.getByRole('button', { name: i === 5 ? x.mission.terminer : x.miniTest.suivant }));
    }
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/mission/terminee'));
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ day: jourLocal(), level: '3e', score: 4, total: 5 }));
    expect(suivre).toHaveBeenCalledWith('mission_completed', expect.objectContaining({ score: 4, total: 5, serie: 1 }));
  });

  it('mission hors ligne : questions embarquées', async () => {
    mockRpc.mockRejectedValue(new Error('hors ligne'));
    await monter(<Mission />);
    await waitFor(() => expect(suivre).toHaveBeenCalledWith('mission_started', { source: 'locale', total: 5 }));
  });

  it('fin : score, série, temps, chapitres et jour de grâce', async () => {
    await AsyncStorage.setItem(
      CLE_DERNIER,
      JSON.stringify({ jour: '2026-10-01', score: 3, total: 4, dureeS: 700, serie: 6, graceUtilisee: false, chapitres: [{ chapitre: 'Fractions', matiere: 'logique', bonnes: 2, total: 3 }] }),
    );
    await monter(<FinMission />);
    await waitFor(() => expect(screen.getByText(x.mission.finTitre)).toBeTruthy());
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText(x.mission.joursDeSuite)).toBeTruthy();
    expect(screen.getByText(x.mission.minutes.replace('{{n}}', '12'))).toBeTruthy();
    expect(screen.getByLabelText('Fractions : 2/3')).toBeTruthy();
    expect(screen.getByText(x.mission.grace)).toBeTruthy();
    await fireEvent.press(screen.getAllByRole('button', { name: x.mission.fin })[1]);
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});

