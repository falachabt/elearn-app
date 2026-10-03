import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { ThemeProvider } from '@/theme/ThemeProvider';
import type { CategorieHorsLigne, EstimationTelechargement } from '@/services/horsLigne';

import { HorsLigne } from '../HorsLigne';

const mockEstimer = jest.fn();
const mockLancer = jest.fn();
const selectionner = (estimation: EstimationTelechargement, categories: readonly CategorieHorsLigne[]) => ({
  ...estimation,
  taches: estimation.taches.filter((tache) => categories.includes(tache.categorie)),
});
const mockSelectionner = jest.fn(selectionner);
const mockRetour = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { back: mockRetour, push: mockPush },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/services/horsLigne', () => ({
  CATEGORIES_HORS_LIGNE: ['missions', 'cours', 'quiz', 'exercices', 'pdf'],
  declinerModeHorsLigne: jest.fn(),
  ecouterHorsLigne: () => () => {},
  estimerTelechargement: () => mockEstimer(),
  lancerTelechargement: (estimation: EstimationTelechargement) => mockLancer(estimation),
  lireEtatHorsLigne: jest.fn(async () => null),
  selectionnerCategories: (estimation: EstimationTelechargement, categories: readonly CategorieHorsLigne[]) => mockSelectionner(estimation, categories),
}));
jest.mock('../../arrivee/MiniTest', () => ({
  BoutonFermer: ({ libelle, onPress }: { libelle: string; onPress: () => void }) => {
    const { Pressable, Text } = jest.requireActual('react-native') as typeof import('react-native');
    return <Pressable accessibilityRole="button" onPress={onPress}><Text>{libelle}</Text></Pressable>;
  },
}));

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };

function estimation(): EstimationTelechargement {
  const taches: EstimationTelechargement['taches'] = [
    { id: 'mission', categorie: 'missions', statut: 'a-faire' },
    { id: 'cours', categorie: 'cours', statut: 'a-faire' },
    { id: 'quiz', categorie: 'quiz', statut: 'a-faire' },
    { id: 'exercice', categorie: 'exercices', statut: 'a-faire' },
    { id: 'pdf', categorie: 'pdf', statut: 'a-faire', tailleOctets: 250 * 1024 ** 2 },
  ];
  return {
    profil: { niveau: '3e', pays: 'CM', concours: null },
    taches,
    progression: {
      missions: { total: 1, faites: 0, echecs: 0 },
      cours: { total: 1, faites: 0, echecs: 0 },
      quiz: { total: 1, faites: 0, echecs: 0 },
      exercices: { total: 1, faites: 0, echecs: 0 },
      pdf: { total: 1, faites: 0, echecs: 0 },
    },
    estimationOctets: taches.reduce((n, tache) => n + (tache.tailleOctets ?? 64 * 1024), 0),
    estimationCategories: {
      missions: { total: 1, octets: 64 * 1024 },
      cours: { total: 1, octets: 64 * 1024 },
      quiz: { total: 1, octets: 64 * 1024 },
      exercices: { total: 1, octets: 64 * 1024 },
      pdf: { total: 1, octets: 250 * 1024 ** 2 },
    },
    espaceDisponible: 2 * 1024 ** 3,
  } satisfies EstimationTelechargement;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEstimer.mockResolvedValue(estimation());
  mockLancer.mockResolvedValue(undefined);
  mockSelectionner.mockImplementation(selectionner);
});

it('affiche la page sans attendre l’estimation et présente les tailles par catégorie', async () => {
  let terminer!: (valeur: ReturnType<typeof estimation>) => void;
  mockEstimer.mockReturnValue(new Promise((resolve) => { terminer = resolve; }));
  const vue = await render(
    <SafeAreaProvider initialMetrics={metriques}>
      <ThemeProvider reglage="clair"><HorsLigne /></ThemeProvider>
    </SafeAreaProvider>,
  );

  expect(vue.getByText(fr.horsLigne.titre)).toBeTruthy();
  expect(vue.getByText(fr.horsLigne.preparation)).toBeTruthy();
  await act(async () => terminer(estimation()));

  expect(await vue.findByText(fr.horsLigne.ressourcesTaille.replace('{{n}}', '1').replace('{{taille}}', '250 Mo'))).toBeTruthy();
  expect(vue.getByText(fr.horsLigne.consommeraInternet)).toBeTruthy();
  expect(mockEstimer).toHaveBeenCalledTimes(1);
});

it('décoche les PDF de plus de 200 Mo par défaut mais permet de les ajouter au téléchargement', async () => {
  const vue = await render(
    <SafeAreaProvider initialMetrics={metriques}>
      <ThemeProvider reglage="clair"><HorsLigne /></ThemeProvider>
    </SafeAreaProvider>,
  );

  const pdf = await vue.findByRole('switch', { name: fr.horsLigne.pdf });
  expect(pdf.props.accessibilityState.checked).toBe(false);
  expect(vue.getByText(fr.horsLigne.pdfLourd)).toBeTruthy();
  expect(mockSelectionner).toHaveBeenCalledWith(expect.anything(), ['missions', 'cours', 'quiz', 'exercices']);

  await fireEvent.press(pdf);
  await fireEvent.press(vue.getByRole('button', { name: fr.horsLigne.telecharger }));

  await waitFor(() => expect(mockLancer).toHaveBeenCalled());
  expect(mockSelectionner).toHaveBeenCalledWith(expect.anything(), ['missions', 'cours', 'quiz', 'exercices', 'pdf']);
});
