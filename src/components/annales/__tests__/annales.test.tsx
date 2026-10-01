import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { changerLangue } from '@/i18n';
import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { Reviser } from '../../reviser/Reviser';
import { lireCatalogue } from '@/services/annales';
import { enregistrerProfil } from '@/services/profil';

import { AnnalesConcours } from '../AnnalesConcours';
import { AnnalesDossier } from '../AnnalesDossier';
import { SujetAnnale } from '../SujetAnnale';

const mockRpc = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (f: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(f, [f]);
  },
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => ({ type: 'opened' })) }));
jest.mock('@/session/SessionProvider', () => ({ useSessionPrete: () => 'u1' }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }) }));

const CATALOGUE = [
  { paper_id: 1, contest_id: 'c1', school: 'Polytechnique Yaoundé', school_code: 'ENSPY', contest: 'Concours 1re année', subject: 'Maths', title: 'Sujet Maths 2024', year: 2024, has_correction: true, duration_min: 180, free: true },
  { paper_id: 2, contest_id: 'c1', school: 'Polytechnique Yaoundé', school_code: 'ENSPY', contest: 'Concours 1re année', subject: 'Physique', title: 'Sujet Physique 2023', year: 2023, has_correction: true, duration_min: null, free: false },
  { paper_id: 3, contest_id: 'c2', school: 'Faculté de médecine', school_code: 'FMSB', contest: 'Concours 1re année', subject: null, title: 'Sujet_BIOLOGIE_2022', year: 2022, has_correction: false, duration_min: null, free: true },
];
const DETAIL = (id: number, verrou: boolean, correction: string | null) => ({ data: [{ paper_id: id, title: CATALOGUE[id - 1].title, subject_url: `https://r2/s${id}.pdf`, correction_url: correction, correction_locked: verrou }], error: null });

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (el: React.ReactElement) =>
  render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair">{el}</ThemeProvider></SafeAreaProvider>);
const T = { fr, en };

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockParams = {};
  mockRpc.mockImplementation(async (nom: string, args?: { p_paper: number }) => {
    if (nom === 'exam_catalog') return { data: CATALOGUE, error: null };
    if (nom === 'class_document_folders')
      return (args as unknown as { p_parent: string | null }).p_parent
        ? { data: [{ folder_id: 'f2', name: 'Séquence 1', subfolders: 0, documents: 1 }], error: null }
        : { data: [{ folder_id: 'f1', name: 'Maths ', subfolders: 1, documents: 3 }, { folder_id: 'f0', name: 'Vide', subfolders: 0, documents: 0 }], error: null };
    if (nom === 'class_documents') return { data: [{ document_id: 'd1', name: 'Sequence 3 Colle╠Çge Prive╠ü.pdf', url: 'https://r2/d1.pdf', correction_url: 'https://r2/d1c.pdf' }], error: null };
    if (nom === 'exam_paper') return args!.p_paper === 1 ? DETAIL(1, false, 'https://r2/c1.pdf') : args!.p_paper === 2 ? DETAIL(2, true, null) : DETAIL(3, false, null);
    return { data: [], error: null };
  });
});
afterAll(() => changerLangue('fr'));

describe.each(['fr', 'en'] as const)('D3, D4 · annales (%s)', (langue) => {
  const x = T[langue];
  beforeEach(() => act(() => changerLangue(langue)));

  it('onglet Annales : dossiers de la classe puis concours', async () => {
    await enregistrerProfil({ type: 'eleve', niveau: '3e', pays: 'CM', termine: true });
    await monter(<Reviser />);
    await fireEvent.press(screen.getByRole('tab', { name: x.annales.onglet }));
    await waitFor(() => expect(screen.getByText(x.annales.maClasse)).toBeTruthy());
    expect(mockRpc).toHaveBeenCalledWith('class_document_folders', { p_level: '3e', p_country: 'CM', p_parent: null });
    expect(screen.getByText('Maths')).toBeTruthy();
    expect(screen.queryByText('Vide')).toBeNull();
    // Les concours ne sont pas mélangés à la classe : ils sont rangés dans « Autres concours ».
    expect(screen.queryByText('ENSPY · Concours 1re année')).toBeNull();
    await fireEvent.press(screen.getByText('Maths'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/annales/dossier', params: { id: 'f1', nom: 'Maths' } });
    await fireEvent.press(screen.getByText(x.annales.autresConcours));
    expect(router.push).toHaveBeenCalledWith('/annales/autres');
  });

  it('candidat avec son concours : ce concours d’abord, les autres dans un dossier', async () => {
    await enregistrerProfil({ type: 'concours', niveau: 'ingenieurs', pays: 'CM', concours: { id: 'c1', sigle: 'ENSPY', nom: 'Concours 1re année' }, termine: true });
    await monter(<Reviser />);
    await fireEvent.press(screen.getByRole('tab', { name: x.annales.onglet }));
    await waitFor(() => expect(screen.getByText(x.annales.monConcours)).toBeTruthy());
    expect(screen.getByText('ENSPY · Concours 1re année')).toBeTruthy();
    expect(screen.getByText(x.annales.sujets.replace('{{n}}', '2'))).toBeTruthy();
    await fireEvent.press(screen.getByText('ENSPY · Concours 1re année'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/annales/concours', params: { id: 'c1', nom: 'ENSPY' } });
  });

  it('candidat aux concours : pas de dossiers de classe', async () => {
    await enregistrerProfil({ type: 'concours', termine: true });
    await monter(<Reviser />);
    await fireEvent.press(screen.getByRole('tab', { name: x.annales.onglet }));
    await waitFor(() => expect(screen.getByText(x.annales.concours)).toBeTruthy());
    expect(screen.queryByText(x.annales.maClasse)).toBeNull();
    expect(mockRpc).not.toHaveBeenCalledWith('class_document_folders', expect.anything());
  });

  it('un concours : ses sujets, badges, filtre par année seulement', async () => {
    mockParams = { id: 'c1', nom: 'ENSPY' };
    await monter(<AnnalesConcours />);
    await waitFor(() => expect(screen.getByText('2024 · Maths')).toBeTruthy());
    expect(screen.queryByText(/Biologie/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'ENSPY' })).toBeNull();
    expect(screen.getByText(x.annales.gratuit)).toBeTruthy();
    expect(screen.getByText(x.annales.pass)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '2023' }));
    expect(screen.queryByText('2024 · Maths')).toBeNull();
    await fireEvent.press(screen.getByText('2023 · Physique'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/annales/sujet', params: { id: '2' } });
  });

  it('dossier de classe : sous-dossiers et documents, sujet et corrigé', async () => {
    mockParams = { id: 'f1', nom: 'Maths' };
    await monter(<AnnalesDossier />);
    await waitFor(() => expect(screen.getByText('Sequence 3 Collège Privé')).toBeTruthy());
    expect(screen.getByText('Séquence 1')).toBeTruthy();
    await fireEvent.press(screen.getByText('Sequence 3 Collège Privé'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://r2/d1.pdf');
    await fireEvent.press(screen.getByText(x.annales.ouvrirCorrection));
    expect(WebBrowser.openBrowserAsync).toHaveBeenLastCalledWith('https://r2/d1c.pdf');
    await fireEvent.press(screen.getByText('Séquence 1'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/annales/dossier', params: { id: 'f2', nom: 'Séquence 1' } });
  });

  it('sujet gratuit : sujet et correction ouverts, source affichée', async () => {
    await lireCatalogue({ rpc: mockRpc } as never);
    mockParams = { id: '1' };
    await monter(<SujetAnnale />);
    await waitFor(() => expect(screen.getByRole('button', { name: x.annales.ouvrirCorrection })).toBeTruthy());
    expect(screen.getByText(x.annales.source.replace('{{ecole}}', 'Polytechnique Yaoundé'))).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: x.annales.ouvrirSujet }));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://r2/s1.pdf');
    await fireEvent.press(screen.getByRole('button', { name: x.annales.ouvrirCorrection }));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://r2/c1.pdf');
  });

  it('sujet réservé au pass : correction verrouillée, vers les offres', async () => {
    mockParams = { id: '2' };
    await monter(<SujetAnnale />);
    await waitFor(() => expect(screen.getByText(x.annales.correctionTitre)).toBeTruthy());
    expect(screen.queryByRole('button', { name: x.annales.ouvrirCorrection })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: x.annales.voirPass }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/offres', params: { declencheur: 'limite' } });
  });

  it('sujet sans correction', async () => {
    mockParams = { id: '3' };
    await monter(<SujetAnnale />);
    await waitFor(() => expect(screen.getByText(x.annales.pasDeCorrection)).toBeTruthy());
  });

  it('erreur à l’ouverture du sujet', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('hors ligne') });
    mockParams = { id: '1' };
    await monter(<SujetAnnale />);
    await waitFor(() => expect(screen.getByText(x.annales.sujetErreur)).toBeTruthy());
  });
});
