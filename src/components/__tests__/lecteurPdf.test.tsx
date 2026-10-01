import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { changerLangue } from '@/i18n';
import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import { effacerDocuments, nomFichier } from '@/services/documents';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { LecteurPdf } from '../LecteurPdf';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockParams,
}));

// Système de fichiers en mémoire : chemin → taille.
const mockFichiers = new Map<string, number>();
const mockTelecharger = jest.fn();
jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    constructor(base: { uri: string } | string, nom?: string) {
      this.uri = `${typeof base === 'string' ? base : base.uri}/${nom ?? ''}`;
    }
    get exists() {
      return [...mockFichiers.keys()].some((k) => k.startsWith(this.uri)) || mockFichiers.has(`${this.uri}/.`);
    }
    create() {
      mockFichiers.set(`${this.uri}/.`, 0);
    }
    delete() {
      for (const k of [...mockFichiers.keys()]) if (k.startsWith(this.uri)) mockFichiers.delete(k);
    }
  }
  class File {
    uri: string;
    constructor(dossier: { uri: string }, nom: string) {
      this.uri = `${dossier.uri}/${nom}`;
    }
    get exists() {
      return mockFichiers.has(this.uri);
    }
    get size() {
      return mockFichiers.get(this.uri) ?? 0;
    }
    static downloadFileAsync = (url: string, f: File) => mockTelecharger(url, f);
  }
  return { Directory, File, Paths: { document: { uri: 'file:///doc' } } };
});

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = () => render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair"><LecteurPdf /></ThemeProvider></SafeAreaProvider>);
const T = { fr, en };
const URL_SUJET = 'https://r2/s1.pdf';
const LOCAL = `file:///doc/documents/${nomFichier(URL_SUJET)}`;

beforeEach(() => {
  jest.clearAllMocks();
  mockFichiers.clear();
  mockParams = { url: URL_SUJET, titre: 'Sujet Maths 2024' };
  mockTelecharger.mockImplementation(async (_url: string, f: { uri: string }) => {
    mockFichiers.set(f.uri, 1000);
    return f;
  });
});
afterAll(() => changerLangue('fr'));

describe.each(['fr', 'en'] as const)('lecteur PDF (%s)', (langue) => {
  const x = T[langue];
  beforeEach(() => act(() => changerLangue(langue)));

  it('première ouverture : téléchargé dans l’app puis affiché, avec les pages', async () => {
    await monter();
    await waitFor(() => expect(screen.getByTestId('lecteur-pdf')).toBeTruthy());
    expect(mockTelecharger).toHaveBeenCalledWith(URL_SUJET, expect.objectContaining({ uri: LOCAL }));
    expect(screen.getByTestId('lecteur-pdf').props.accessibilityLabel).toBe(LOCAL);
    expect(screen.getByText('Sujet Maths 2024')).toBeTruthy();
    expect(screen.getByLabelText(x.document.page.replace('{{n}}', '1').replace('{{total}}', '3'))).toBeTruthy();
  });

  it('déjà gardé : ouvert sans réseau', async () => {
    mockFichiers.set(LOCAL, 1000);
    await monter();
    expect(screen.getByTestId('lecteur-pdf')).toBeTruthy();
    expect(mockTelecharger).not.toHaveBeenCalled();
  });

  it('hors ligne et jamais ouvert : erreur, puis réessayer', async () => {
    mockTelecharger.mockRejectedValueOnce(new Error('hors ligne'));
    await monter();
    await waitFor(() => expect(screen.getByText(x.document.erreur)).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.reviser.reessayer }));
    await waitFor(() => expect(screen.getByTestId('lecteur-pdf')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.reviser.retour }));
    expect(router.back).toHaveBeenCalled();
  });

  it('déconnexion : les documents sont effacés', () => {
    mockFichiers.set(LOCAL, 1000);
    effacerDocuments();
    expect(mockFichiers.size).toBe(0);
  });
});
