import AsyncStorage from '@react-native-async-storage/async-storage';

import { CLE_EXERCICES_FAITS, CLE_SESSIONS } from '../entrainement';
import { CLE_ETAT_HORS_LIGNE } from '../horsLigne';
import { CLE_LUES } from '../reviser';
import { CLE_RYTHME } from '../rythme';
import { selectionnerCategories, type EstimationTelechargement } from '../horsLigne';
import { lireProgressionAssistant, noterActionConfiguration } from '../assistantConfiguration';

jest.mock('expo-notifications', () => ({}));

beforeEach(async () => {
  await AsyncStorage.clear();
});

it('reflète les actions réellement terminées et le téléchargement hors ligne achevé', async () => {
  await AsyncStorage.multiSet([
    [CLE_RYTHME, '20'],
    [CLE_LUES, JSON.stringify({ 12: 4 })],
    [CLE_SESSIONS, JSON.stringify({ quiz1: [{ le: '2026-10-01', score: 2, total: 3 }] })],
    [CLE_EXERCICES_FAITS, JSON.stringify({ exercice1: true })],
    [
      CLE_ETAT_HORS_LIGNE,
      JSON.stringify({
        statut: 'termine',
        progression: Object.fromEntries(['missions', 'cours', 'quiz', 'exercices', 'pdf'].map((categorie) => [categorie, { total: 1, faites: 1, echecs: 0 }])),
      }),
    ],
  ]);
  await noterActionConfiguration('correction');
  await noterActionConfiguration('fil');

  await expect(lireProgressionAssistant()).resolves.toMatchObject({
    mission: true,
    lecon: true,
    quiz: true,
    exercice: true,
    correction: true,
    fil: true,
    horsLigne: true,
    progressionHorsLigne: 100,
  });
});

it('ne marque pas le mode hors ligne terminé avant la fin du téléchargement', async () => {
  await AsyncStorage.setItem(CLE_ETAT_HORS_LIGNE, JSON.stringify({
    statut: 'telechargement',
    progression: { missions: { total: 2, faites: 1, echecs: 0 } },
  }));

  await expect(lireProgressionAssistant()).resolves.toMatchObject({
    horsLigne: false,
    progressionHorsLigne: 50,
  });
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
