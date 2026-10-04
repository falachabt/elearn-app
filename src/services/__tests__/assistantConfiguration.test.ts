import AsyncStorage from '@react-native-async-storage/async-storage';

import { CLE_EXERCICES_FAITS, CLE_SESSIONS } from '../entrainement';
import { CLE_LUES } from '../reviser';
import { CLE_RYTHME } from '../rythme';
import { CLE_ETAT_HORS_LIGNE, selectionnerCategories, type EstimationTelechargement } from '../horsLigne';
import { lireProgressionAssistant, noterActionConfiguration } from '../assistantConfiguration';

const mockGetSession = jest.fn();
const mockFrom = jest.fn();

jest.mock('expo-notifications', () => ({}));
jest.mock('../supabase', () => ({
  getSupabase: () => ({ auth: { getSession: mockGetSession }, from: (table: string) => mockFrom(table) }),
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'user-1', is_anonymous: false } } }, error: null });
  mockFrom.mockImplementation(() => {
    const query = {
      select: () => query,
      eq: () => query,
      limit: () => query,
      maybeSingle: async () => ({ data: null, error: null }),
    };
    return query;
  });
});

it('reflète les actions réellement terminées', async () => {
  await AsyncStorage.multiSet([
    [CLE_RYTHME, '20'],
    [CLE_LUES, JSON.stringify({ 12: 4 })],
    [CLE_SESSIONS, JSON.stringify({ quiz1: [{ le: '2026-10-01', score: 2, total: 3 }] })],
    [CLE_EXERCICES_FAITS, JSON.stringify({ exercice1: true })],
  ]);
  await noterActionConfiguration('correction');
  await noterActionConfiguration('fil');
  await noterActionConfiguration('parametres');

  await expect(lireProgressionAssistant()).resolves.toMatchObject({
    mission: true,
    lecon: true,
    quiz: true,
    exercice: true,
    correction: true,
    fil: true,
    parametres: true,
    horsLigne: false,
  });
});

it('marque le contenu hors ligne comme terminé uniquement après la fin du téléchargement', async () => {
  await AsyncStorage.setItem(CLE_ETAT_HORS_LIGNE, JSON.stringify({ statut: 'telechargement' }));
  await expect(lireProgressionAssistant()).resolves.toMatchObject({ horsLigne: false });

  await AsyncStorage.setItem(CLE_ETAT_HORS_LIGNE, JSON.stringify({ statut: 'termine' }));
  await expect(lireProgressionAssistant()).resolves.toMatchObject({ horsLigne: true });
});

it('reconnaît les corrections IA et la participation au fil effectuées avant cet assistant', async () => {
  mockFrom.mockImplementation((table: string) => {
    const query = {
      select: () => query,
      eq: () => query,
      limit: () => query,
      maybeSingle: async () => ({ data: table === 'photo_corrections' || table === 'post_comments' ? { id: table } : null, error: null }),
    };
    return query;
  });

  await expect(lireProgressionAssistant()).resolves.toMatchObject({ correction: true, fil: true });
  expect(mockFrom).toHaveBeenCalledWith('photo_corrections');
  expect(mockFrom).toHaveBeenCalledWith('feed_posts');
  expect(mockFrom).toHaveBeenCalledWith('post_comments');
  expect(mockFrom).toHaveBeenCalledWith('poll_votes');
});

it('reconnaît aussi un quiz de validation de leçon terminé', async () => {
  await noterActionConfiguration('quiz');

  await expect(lireProgressionAssistant()).resolves.toMatchObject({ quiz: true });
});

it('calcule le poids par catégorie et retire les catégories décochées du téléchargement', () => {
  const estimation = {
    profil: { niveau: '3e', pays: 'CM', concours: null },
    taches: [
      { id: 'mission', categorie: 'missions', statut: 'a-faire' },
      { id: 'cours', categorie: 'cours', statut: 'a-faire' },
      { id: 'sujet', categorie: 'pdf', statut: 'a-faire', tailleOctets: 1_200_000_000 },
    ],
    progression: {} as EstimationTelechargement['progression'],
    estimationOctets: 0,
    estimationCategories: {} as EstimationTelechargement['estimationCategories'],
    espaceDisponible: 2_000_000_000,
  } satisfies EstimationTelechargement;

  const choisie = selectionnerCategories(estimation, ['missions', 'pdf']);

  expect(choisie.taches.map((tache) => tache.id)).toEqual(['mission', 'sujet']);
  expect(choisie.estimationCategories.missions).toEqual({ total: 1, octets: 32 * 1024 });
  expect(choisie.estimationCategories.pdf).toEqual({ total: 1, octets: 1_200_000_000 });
  expect(choisie.estimationOctets).toBe(1_200_000_000 + 32 * 1024);
});
