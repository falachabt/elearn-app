import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { changerLangue } from '@/i18n';
import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { adresseEncodee, effacerDocuments, lireDocuments, noterPage, nomFichier, ouvrirDocument, pageDocument, prechargerDocument, retirerTousDocuments } from '@/services/documents';
import { lireActivitesJours } from '@/services/activite';
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
  useNavigation: () => ({ addListener: jest.fn(() => () => {}), dispatch: jest.fn() }),
}));

const mockDeclencher = jest.fn();
jest.mock('../useFeedback', () => ({ useFeedback: () => ({ declencher: (...a: unknown[]) => mockDeclencher(...a) }) }));
const mockProgrammerFin = jest.fn();
const mockAnnulerFin = jest.fn();
jest.mock('@/services/finChrono', () => ({
  programmerFinChrono: (...a: unknown[]) => mockProgrammerFin(...a),
  annulerFinChrono: (...a: unknown[]) => mockAnnulerFin(...a),
}));

const mockDepenser = jest.fn();
jest.mock('@/session/CreditsProvider', () => ({
  useCredits: () => ({ solde: null, couts: { exam_correction: 5, document_pdf: 3 }, depenser: (...a: unknown[]) => mockDepenser(...a), rafraichir: async () => {}, depensesEnAttente: 0 }),
}));
jest.mock('@/session/SessionProvider', () => ({ useSessionPrete: () => 'u1', useSession: () => ({ session: { user: { id: 'u1', is_anonymous: false } } }) }));

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
  mockProgrammerFin.mockResolvedValue(null);
  await AsyncStorage.clear();
  await AsyncStorage.setItem('annales.chrono.onboarding_vu', '1');
  await AsyncStorage.setItem('annales.chrono.ne_plus_afficher', '1');
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
    expect(screen.getByTestId('lecteur-pdf', { includeHiddenElements: true }).props.accessibilityLabel).toBe(LOCAL);
    expect(screen.getByText('Sujet Maths 2024')).toBeTruthy();
    expect(screen.getByLabelText(x.document.page.replace('{{n}}', '1').replace('{{total}}', '3'))).toBeTruthy();
  });

  it('changer de page ne redonne pas de props au PDF natif (page vide en bas d’un document court)', async () => {
    await monter();
    await waitFor(() => expect(screen.getByTestId('lecteur-pdf')).toBeTruthy());
    const avant = (globalThis as { rendusPdf?: number }).rendusPdf;
    await act(async () => screen.getByTestId('lecteur-pdf').props.pdf.onPageChanged(2, 2));
    expect(screen.getByLabelText(x.document.page.replace('{{n}}', '2').replace('{{total}}', '2'))).toBeTruthy();
    expect((globalThis as { rendusPdf?: number }).rendusPdf).toBe(avant);
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
    // Annale de concours (sujet 7) : la page de détail du sujet, plus le lecteur direct.
    expect(router.push).toHaveBeenCalledWith({ pathname: '/annales/sujet', params: { id: '7' } });
    // Document sans origine connue : le lecteur seul, sans menu de chrono.
    await fireEvent.press(screen.getByText('Correction'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/document', params: { url: 'https://r2/c1.pdf', titre: 'Correction' } });
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

  it('sans temps choisi (document rouvert) : aucun menu de chrono, lecture directe', async () => {
    await AsyncStorage.clear();
    await monter();
    await waitFor(() => expect(screen.getByTestId('lecteur-pdf')).toBeTruthy());
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(AsyncStorage.getItem('annales.chrono.onboarding_vu')).resolves.toBeNull();
  });

  it('un ancien sujet gardé rouvre sa page de détail depuis « Mes documents »', async () => {
    await ouvrirDocument('https://r2/s.pdf', 'Sujet Maths · Correction', new Date(), undefined, undefined, { kind: 'document', ref: 'abc', corr: 'def' });
    const [d] = await lireDocuments();
    expect(d.origine).toEqual({ kind: 'document', ref: 'abc', corr: 'def' });
  });

  describe('#72 · temps choisi, sujet / correction, correction du travail', () => {
    const URL_CORR = 'https://r2/c1.pdf';
    const parametres = (extra: Record<string, string> = {}) => ({
      url: URL_SUJET,
      titre: 'Sujet Maths 2024',
      kind: 'exam',
      ref: '1',
      corrAction: 'exam_correction',
      corrRef: '1',
      sujet: '1',
      duree: 'libre',
      ...extra,
    });
    beforeEach(() => {
      mockDepenser.mockResolvedValue({ statut: 'spent', cout: 0, solde: 20, contenu: { url: URL_CORR } });
    });

    it('temps déjà choisi sur la page du sujet : le lecteur s’ouvre directement', async () => {
      await AsyncStorage.clear();
      mockParams = parametres({ duree: '5400' });
      await monter();
      await waitFor(() => expect(screen.getByTestId('lecteur-pdf')).toBeTruthy());
    });

    it('sans paramètres de sujet : aucun bouton de correction (documents de cours)', async () => {
      await monter();
      await waitFor(() => expect(screen.getByTestId('lecteur-pdf')).toBeTruthy());
      expect(screen.queryByRole('button', { name: x.travail.voirCorrection })).toBeNull();
      expect(screen.queryByRole('button', { name: x.travail.corriger })).toBeNull();
    });

    it('sujet sans corrigé : seule l’action « Corriger mon travail »', async () => {
      mockParams = parametres({ corrRef: '' });
      await monter();
      await waitFor(() => expect(screen.getByTestId('lecteur-pdf')).toBeTruthy());
      expect(screen.queryByRole('button', { name: x.travail.voirCorrection })).toBeNull();
      expect(screen.getByRole('button', { name: x.travail.corriger })).toBeTruthy();
    });

    it('« Voir la correction » charge le corrigé dans le même lecteur, puis « Voir le sujet » revient sans redépenser', async () => {
      mockParams = parametres();
      await monter();
      await waitFor(() => expect(screen.getByTestId('lecteur-pdf')).toBeTruthy());
      await fireEvent.press(screen.getByRole('button', { name: x.travail.voirCorrection }));
      expect(mockDepenser).toHaveBeenCalledWith('exam_correction', '1');
      await waitFor(() => expect(mockTelecharger).toHaveBeenCalledWith(URL_CORR, expect.anything()));
      await waitFor(() => expect(screen.getByRole('button', { name: x.travail.voirSujet })).toBeTruthy());
      expect(screen.getByText(`Sujet Maths 2024 · ${x.annales.correctionTitre}`)).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: x.travail.voirSujet }));
      await waitFor(() => expect(screen.getByRole('button', { name: x.travail.voirCorrection })).toBeTruthy());
      expect(mockDepenser).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Sujet Maths 2024')).toBeTruthy();
    });

    it('ouvert sur la correction : le titre ne double pas le suffixe', async () => {
      mockParams = parametres({ url: URL_CORR, vue: 'correction', titre: `Sujet Maths 2024 · ${x.annales.correctionTitre}` });
      await monter();
      await waitFor(() => expect(screen.getByTestId('lecteur-pdf')).toBeTruthy());
      expect(screen.getByText(`Sujet Maths 2024 · ${x.annales.correctionTitre}`)).toBeTruthy();
      expect(screen.getByRole('button', { name: x.travail.voirSujet })).toBeTruthy();
    });

    it('crédits insuffisants : on reste sur le sujet', async () => {
      mockDepenser.mockResolvedValue({ statut: 'insufficient', cout: 5, solde: 1, contenu: null });
      mockParams = parametres();
      await monter();
      await waitFor(() => expect(screen.getByTestId('lecteur-pdf')).toBeTruthy());
      await fireEvent.press(screen.getByRole('button', { name: x.travail.voirCorrection }));
      await waitFor(() => expect(mockDepenser).toHaveBeenCalled());
      expect(screen.getByTestId('lecteur-pdf', { includeHiddenElements: true }).props.accessibilityLabel).toBe(LOCAL);
      expect(mockTelecharger).not.toHaveBeenCalledWith(URL_CORR, expect.anything());
    });

    it('fin du chrono : son de fin, feuille « Temps écoulé » avec correction, correction du travail et quitter', async () => {
      mockProgrammerFin.mockResolvedValue('notif-1');
      mockParams = parametres({ duree: '1' });
      await monter();
      await waitFor(() => expect(screen.getByTestId('lecteur-pdf')).toBeTruthy());
      expect(screen.queryByText(x.travail.tempsEcouleTitre)).toBeNull();
      await waitFor(() => expect(screen.getByText(x.travail.tempsEcouleTitre)).toBeTruthy(), { timeout: 4000 });
      expect(mockDeclencher).toHaveBeenCalledWith('timerEnd');
      expect(mockProgrammerFin).toHaveBeenCalled();
      expect(screen.getAllByRole('button', { name: x.travail.voirCorrection }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: x.travail.corriger }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('button', { name: x.travail.quitter }).length).toBeGreaterThan(0);
    });

    it('fin du chrono sur un sujet sans corrigé : pas de « Voir la correction » dans la feuille', async () => {
      mockParams = parametres({ duree: '1', corrRef: '' });
      await monter();
      await waitFor(() => expect(screen.getByText(x.travail.tempsEcouleTitre)).toBeTruthy(), { timeout: 4000 });
      expect(screen.queryByRole('button', { name: x.travail.voirCorrection })).toBeNull();
      expect(screen.getAllByRole('button', { name: x.travail.corriger }).length).toBeGreaterThan(0);
    });

    it('chrono libre : aucune feuille, aucune notification', async () => {
      mockParams = parametres({ duree: 'libre' });
      await monter();
      await waitFor(() => expect(screen.getByTestId('lecteur-pdf')).toBeTruthy());
      expect(screen.queryByText(x.travail.tempsEcouleTitre)).toBeNull();
      expect(mockProgrammerFin).not.toHaveBeenCalled();
    });

    it('« Corriger mon travail » ouvre le choix photos / galerie', async () => {
      mockParams = parametres();
      await monter();
      await waitFor(() => expect(screen.getByTestId('lecteur-pdf')).toBeTruthy());
      await fireEvent.press(screen.getByRole('button', { name: x.travail.corriger }));
      await waitFor(() => expect(screen.getByText(x.travail.feuilleTitre)).toBeTruthy());
      expect(screen.getByText(x.travail.prendre)).toBeTruthy();
    });
  });

  it('déconnexion : les documents sont effacés', () => {
    mockFichiers.set(LOCAL, 1000);
    effacerDocuments();
    expect(mockFichiers.size).toBe(0);
  });
});

describe('documents préchargés : cache et « Mes documents » cohérents', () => {
  const PRECHARGE = 'https://r2/precharge.pdf';

  it('un document préchargé est en cache mais pas dans la liste, jusqu’à sa première ouverture', async () => {
    await prechargerDocument(PRECHARGE, 'Annale préchargée');
    expect(mockTelecharger).toHaveBeenCalledTimes(1);
    expect(await lireDocuments()).toEqual([]);
    await ouvrirDocument(PRECHARGE, 'Annale préchargée');
    // Le fichier était déjà là : l'ajout à la liste ne relance aucun téléchargement.
    expect(mockTelecharger).toHaveBeenCalledTimes(1);
    expect((await lireDocuments()).map((d) => d.titre)).toEqual(['Annale préchargée']);
  });

  it('« Tout supprimer » vide la liste mais garde les fichiers préchargés pas encore ouverts', async () => {
    await prechargerDocument(PRECHARGE, 'Annale préchargée');
    await ouvrirDocument(URL_SUJET, 'Sujet ouvert');
    await retirerTousDocuments();
    expect(await lireDocuments()).toEqual([]);
    expect(mockFichiers.has(LOCAL)).toBe(false);
    expect(mockFichiers.has(`file:///doc/documents/${nomFichier(PRECHARGE)}`)).toBe(true);
    // Et son ouverture hors ligne ne retélécharge rien.
    mockTelecharger.mockClear();
    await ouvrirDocument(PRECHARGE, 'Annale préchargée');
    expect(mockTelecharger).not.toHaveBeenCalled();
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

describe('temps passé sur un ancien sujet : compté dans Ma progression', () => {
  const passer = async (params: Record<string, string>) => {
    jest.useFakeTimers();
    try {
      mockParams = { url: URL_SUJET, titre: 'Sujet Maths 2024', ...params };
      const vue = await monter();
      await act(async () => { await jest.advanceTimersByTimeAsync(500); });
      await act(async () => { await jest.advanceTimersByTimeAsync(12_000); });
      await vue.unmount();
      await act(async () => { await jest.advanceTimersByTimeAsync(100); });
    } finally {
      jest.useRealTimers();
    }
    return Object.values(await lireActivitesJours())[0]?.parType;
  };

  it('un concours (sujet) compte en Annale', async () => {
    const parType = await passer({ sujet: '7', kind: 'exam', ref: '7' });
    expect(parType?.annale ?? 0).toBeGreaterThanOrEqual(10);
    expect(parType?.cours ?? 0).toBe(0);
  });

  it('un document de classe (kind=document) compte aussi en Annale', async () => {
    const parType = await passer({ kind: 'document', ref: '3' });
    expect(parType?.annale ?? 0).toBeGreaterThanOrEqual(10);
  });

  it('un PDF de cours reste en Cours', async () => {
    const parType = await passer({});
    expect(parType?.cours ?? 0).toBeGreaterThanOrEqual(10);
    expect(parType?.annale ?? 0).toBe(0);
  });
});
