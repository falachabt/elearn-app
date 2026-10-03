import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { filtrerConcours, type ConcoursFiliere } from '@/services/concours';
import { enregistrerProfil, lireProfil } from '@/services/profil';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { ChoixConcours } from '../ChoixConcours';

const mockRpc = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) } }));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));
jest.mock('@/session/SessionProvider', () => ({ useSessionPrete: () => 'u1' }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }) }));

const FILIERES = [
  { code: 'ingenieurs', name_fr: 'Écoles d’ingénieurs', name_en: 'Engineering', icon: 'construct-outline', contests: 2 },
  { code: 'sante', name_fr: 'Médecine et santé', name_en: 'Health', icon: 'medkit-outline', contests: 1 },
];
const CONCOURS = [
  { contest_id: 'c1', sigle: 'ENSPY', school: 'Polytechnique Yaoundé', name: 'Entrée 1re année', cycle: 'Premier cycle', city: 'Yaoundé', next_date: null, papers: 22, lessons: 300 },
  { contest_id: 'c2', sigle: 'ENSPD', school: 'Polytechnique Douala', name: 'Entrée 1re année', cycle: 'Premier cycle', city: 'Douala', next_date: null, papers: 9, lessons: 300 },
];

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = () => render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair"><ChoixConcours /></ThemeProvider></SafeAreaProvider>);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockRpc.mockImplementation(async (nom: string) => ({ data: nom === 'contest_track_list' ? FILIERES : CONCOURS, error: null }));
});

it('filière puis concours : le concours est enregistré dans le profil', async () => {
  await enregistrerProfil({ type: 'concours', niveau: 'ingenieurs', pays: 'CM', termine: true });
  await AsyncStorage.setItem('mission.jour', '{}');
  await monter();
  await waitFor(() => expect(screen.getByText(fr.concours.filiereTitre)).toBeTruthy());
  await fireEvent.press(screen.getByRole('radio', { name: /Médecine et santé/ }));
  await fireEvent.press(screen.getByRole('radio', { name: /Écoles d’ingénieurs/ }));
  await fireEvent.press(screen.getByRole('button', { name: fr.concours.suivant }));
  await waitFor(() => expect(screen.getByText(fr.concours.concoursTitre)).toBeTruthy());
  expect(mockRpc).toHaveBeenCalledWith('track_contests', { p_track: 'ingenieurs' });
  await waitFor(() => expect(screen.getByRole('radio', { name: /ENSPD · Douala/ })).toBeTruthy());
  await fireEvent.press(screen.getByRole('radio', { name: /ENSPD · Douala/ }));
  await fireEvent.press(screen.getByRole('button', { name: fr.concours.choisir.replace('{{sigle}}', 'ENSPD') }));
  await waitFor(() => expect(router.back).toHaveBeenCalled());
  expect(await lireProfil()).toEqual({
    type: 'concours',
    niveau: 'ingenieurs',
    pays: 'CM',
    concours: { id: 'c2', sigle: 'ENSPD', nom: 'Entrée 1re année', ville: 'Douala' },
    termine: true,
  });
  expect(await AsyncStorage.getItem('mission.jour')).toBeNull();
  expect(suivre).toHaveBeenCalledWith('contest_chosen', { filiere: 'ingenieurs', concours: 'ENSPD' });
});

it('recherche sans accents ni casse', () => {
  const liste = CONCOURS.map((c) => ({ id: c.contest_id, sigle: c.sigle, nom: c.name, ville: c.city, ecole: c.school, cycle: c.cycle, date: null, sujets: c.papers, lecons: c.lessons })) as ConcoursFiliere[];
  expect(filtrerConcours(liste, 'yaounde').map((c) => c.sigle)).toEqual(['ENSPY']);
  expect(filtrerConcours(liste, '  ').length).toBe(2);
});
