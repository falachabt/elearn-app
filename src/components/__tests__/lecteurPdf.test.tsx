import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { changerLangue } from '@/i18n';
import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { adresseEncodee, effacerDocuments, lireDocuments, noterPage, nomFichier, ouvrirDocument, pageDocument } from '@/services/documents';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { LecteurPdf } from '../LecteurPdf';
import { MesDocuments, quandOuvert } from '../MesDocuments';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (f: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(f, [f]);
  },
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
    delete() {
      mockFichiers.delete(this.uri);
    }
    static downloadFileAsync = (url: string, f: File) => mockTelecharger(url, f);
  }
  return { Directory, File, Paths: { document: { uri: 'file:///doc' } } };
});

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (el: React.ReactElement = <LecteurPdf />) => render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair">{el}</ThemeProvider></SafeAreaProvider>);
const T = { fr, en };
const URL_SUJET = 'https://r2/s1.pdf';
const LOCAL = `file:///doc/documents/${nomFichier(URL_SUJET)}`;

beforeEach(async () => {
  jest.clearAllMocks();
  mockFichiers.clear();
  await AsyncStorage.clear();
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

  it('déjà gardé : ouvert sans réseau, à la dernière page lue', async () => {
    await ouvrirDocument(URL_SUJET, 'Sujet Maths 2024');
    await noterPage(URL_SUJET, 2);
    mockTelecharger.mockClear();
    await monter();
    await waitFor(() => expect(screen.getByTestId('lecteur-pdf')).toBeTruthy());
    expect(mockTelecharger).not.toHaveBeenCalled();
    expect(screen.getByLabelText(x.document.page.replace('{{n}}', '2').replace('{{total}}', '3'))).toBeTruthy();
    expect(screen.getByText(x.document.reprise.replace('{{n}}', '2'))).toBeTruthy();
    // Zoom par les boutons − / + (pas de bouton télécharger ni partager).
    await fireEvent.press(screen.getByRole('button', { name: x.document.zoomPlus }));
    expect(screen.getByRole('button', { name: x.document.zoomMoins })).toBeTruthy();
  });

  it('mes documents : liste, ouvrir, retirer', async () => {
    await ouvrirDocument(URL_SUJET, 'Sujet Maths 2024', new Date('2026-09-30T10:00:00Z'), undefined, 7);
    await ouvrirDocument('https://r2/c1.pdf', 'Correction', new Date('2026-10-01T10:00:00Z'));
    await monter(<MesDocuments />);
    await waitFor(() => expect(screen.getByText('Correction')).toBeTruthy());
    expect(screen.getAllByText(/^(Correction|Sujet Maths 2024)$/).map((e) => e.props.children)).toEqual(['Correction', 'Sujet Maths 2024']);
    await fireEvent.press(screen.getByText('Sujet Maths 2024'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/document', params: { url: URL_SUJET, titre: 'Sujet Maths 2024' } });
    await fireEvent.press(screen.getByRole('button', { name: x.document.retirer.replace('{{titre}}', 'Correction') }));
    await waitFor(() => expect(screen.queryByText('Correction')).toBeNull());
    expect((await lireDocuments()).map((d) => [d.titre, d.sujet])).toEqual([['Sujet Maths 2024', 7]]);
    // Tout supprimer, après confirmation.
    await fireEvent.press(screen.getByRole('button', { name: x.document.toutSupprimer }));
    await fireEvent.press(screen.getByRole('button', { name: x.document.confirmer }));
    await waitFor(() => expect(screen.getByText(x.document.aucunCourt)).toBeTruthy());
    expect(await lireDocuments()).toEqual([]);
  });

  it('hors ligne et jamais ouvert : erreur, puis réessayer', async () => {
    mockTelecharger.mockRejectedValueOnce(new Error('hors ligne'));
    await monter();
    await waitFor(() => expect(screen.getByText(x.document.erreurTitre)).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.document.reessayer }));
    await waitFor(() => expect(screen.getByTestId('lecteur-pdf')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.reviser.retour }));
    expect(router.back).toHaveBeenCalled();
  });

  it('plafond : les documents ouverts le moins récemment partent', async () => {
    await ouvrirDocument('https://r2/a.pdf', 'A', new Date('2026-09-28T10:00:00Z'), 2500);
    await ouvrirDocument('https://r2/b.pdf', 'B', new Date('2026-09-29T10:00:00Z'), 2500);
    await ouvrirDocument('https://r2/c.pdf', 'C', new Date('2026-09-30T10:00:00Z'), 2500);
    expect((await lireDocuments()).map((d) => d.titre)).toEqual(['C', 'B']);
    expect(await pageDocument('https://r2/c.pdf')).toBe(1);
  });

  it('adresse avec espaces et accents : encodée pour le téléchargement, une seule fois', async () => {
    const brute = 'https://r2/docs/Séquence 5 COLLEGE.pdf';
    expect(adresseEncodee(brute)).toBe('https://r2/docs/S%C3%A9quence%205%20COLLEGE.pdf');
    expect(adresseEncodee(adresseEncodee(brute))).toBe('https://r2/docs/S%C3%A9quence%205%20COLLEGE.pdf');
    await ouvrirDocument(brute, 'Séquence 5');
    expect(mockTelecharger).toHaveBeenCalledWith('https://r2/docs/S%C3%A9quence%205%20COLLEGE.pdf', expect.anything());
  });

  it('déconnexion : les documents sont effacés', () => {
    mockFichiers.set(LOCAL, 1000);
    effacerDocuments();
    expect(mockFichiers.size).toBe(0);
  });
});

describe('quandOuvert', () => {
  it('aujourd’hui, hier, sinon la date', () => {
    const maintenant = new Date('2026-10-01T09:00:00');
    expect(quandOuvert('2026-10-01T07:00:00', maintenant)).toBe('aujourdhui');
    expect(quandOuvert('2026-09-30T22:00:00', maintenant)).toBe('hier');
    expect(quandOuvert('2026-09-28T10:00:00', maintenant)).toBeNull();
  });
});
