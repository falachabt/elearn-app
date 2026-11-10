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
const mockDepenser = jest.fn();
jest.mock('@/session/CreditsProvider', () => ({
  useCredits: () => ({ solde: null, couts: { exam_correction: 5, document_pdf: 3 }, depenser: (...a: unknown[]) => mockDepenser(...a), rafraichir: async () => {} }),
}));
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
jest.mock('@/session/SessionProvider', () => ({ useSessionPrete: () => 'u1', useSession: () => ({ session: { user: { id: 'u1', is_anonymous: false } } }) }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }) }));

const CATALOGUE = [
  { paper_id: 1, contest_id: 'c1', school: 'Polytechnique Yaoundé', school_code: 'ENSPY', contest: 'Concours 1re année', subject: 'Maths', title: 'Sujet Maths 2024', year: 2024, has_correction: true, duration_min: 180, free: true },
  { paper_id: 2, contest_id: 'c1', school: 'Polytechnique Yaoundé', school_code: 'ENSPY', contest: 'Concours 1re année', subject: 'Physique', title: 'Sujet Physique 2023', year: 2023, has_correction: true, duration_min: null, free: false },
  { paper_id: 3, contest_id: 'c2', school: 'Faculté de médecine', school_code: 'FMSB', contest: 'Concours 1re année', subject: null, title: 'Sujet_BIOLOGIE_2022', year: 2022, has_correction: false, duration_min: null, free: true },
];
const DETAIL = (id: number, aCorrection: boolean, gratuite: boolean) => ({ data: [{ paper_id: id, title: CATALOGUE[id - 1].title, subject_url: `https://r2/s${id}.pdf`, has_correction: aCorrection, correction_free: gratuite }], error: null });

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (el: React.ReactElement) =>
  render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair">{el}</ThemeProvider></SafeAreaProvider>);
const T = { fr, en };

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockParams = {};
  mockDepenser.mockImplementation(async (action: string, objet: string) => ({
    statut: 'spent',
    cout: 3,
    solde: 20,
    contenu: { url: action === 'exam_correction' ? `https://r2/c${objet}.pdf` : `https://r2/${objet}.pdf` },
  }));
  mockRpc.mockImplementation(async (nom: string, args?: { p_paper: number }) => {
    if (nom === 'exam_catalog') return { data: CATALOGUE, error: null };
    if (nom === 'class_document_folders')
      return (args as unknown as { p_parent: string | null }).p_parent
        ? { data: [{ folder_id: 'f2', name: 'Séquence 1', subfolders: 0, documents: 1 }], error: null }
        : { data: [{ folder_id: 'f1', name: 'Maths ', subfolders: 1, documents: 3 }, { folder_id: 'f0', name: 'Vide', subfolders: 0, documents: 0 }], error: null };
    if (nom === 'class_documents') return { data: [{ document_id: 'd1', name: 'Sequence 3 Colle╠Çge Prive╠ü.pdf', correction_id: 'd1c' }], error: null };
    if (nom === 'my_free_documents_left') return { data: 2, error: null };
    if (nom === 'my_unlocked_refs') return { data: ['d1c'], error: null };
    if (nom === 'exam_paper') return args!.p_paper === 1 ? DETAIL(1, true, true) : args!.p_paper === 2 ? DETAIL(2, true, false) : DETAIL(3, false, false);
    return { data: [], error: null };
  });
});
afterAll(() => changerLangue('fr'));

describe.each(['fr', 'en'] as const)('D3, D4 · annales (%s)', (langue) => {
  const x = T[langue];
  beforeEach(() => act(() => changerLangue(langue)));

  it('onglet Annales : dossiers de la classe seulement', async () => {
    await enregistrerProfil({ type: 'eleve', niveau: '3e', pays: 'CM', termine: true });
    await monter(<Reviser />);
    await fireEvent.press(screen.getByRole('tab', { name: x.annales.onglet }));
    await waitFor(() => expect(screen.getByLabelText(x.annales.rechercher)).toBeTruthy());
    expect(mockRpc).toHaveBeenCalledWith('class_document_folders', { p_level: '3e', p_country: 'CM', p_parent: null });
    expect(screen.getByText('Maths')).toBeTruthy();
    expect(screen.queryByText('Vide')).toBeNull();
    // L'élève ne voit que sa classe : ni concours, ni carte « Autres concours ».
    expect(screen.queryByText('ENSPY · Concours 1re année')).toBeNull();
    expect(screen.queryByText(x.annales.autresConcours)).toBeNull();
    await fireEvent.press(screen.getByText('Maths'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/annales/dossier', params: { id: 'f1', nom: 'Maths' } });
  });

  it('candidat avec son concours : ses sujets directement, filtrables, sans les autres concours', async () => {
    await enregistrerProfil({ type: 'concours', niveau: 'ingenieurs', pays: 'CM', concours: { id: 'c1', sigle: 'ENSPY', nom: 'Concours 1re année' }, termine: true });
    await monter(<Reviser />);
    await fireEvent.press(screen.getByRole('tab', { name: x.annales.onglet }));
    await waitFor(() => expect(screen.getByText('ENSPY · Concours 1re année')).toBeTruthy());
    expect(screen.getByText('Maths 2024')).toBeTruthy();
    expect(screen.queryByText(/Biologie/)).toBeNull();
    expect(screen.queryByText(x.annales.autresConcours)).toBeNull();
    expect(screen.getByText(x.annales.sujets.replace('{{n}}', '2'))).toBeTruthy();
    // Filtre Matière, puis « Effacer les filtres » quand rien ne correspond.
    await fireEvent.press(screen.getByRole('button', { name: 'Physique' }));
    expect(screen.queryByText('Maths 2024')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: '2024' }));
    expect(screen.getByText(x.annales.videFiltres)).toBeTruthy();
    await fireEvent.press(screen.getByText(x.annales.effacerFiltres));
    expect(screen.getByText('Maths 2024')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '2023' }));
    expect(screen.queryByText('Maths 2024')).toBeNull();
    await fireEvent.press(screen.getByText('Physique 2023'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/annales/sujet', params: { id: '2' } });
  });

  it('recherche : remplace le titre « Ma classe », filtre en direct sans tenir compte des accents, état vide et croix pour effacer', async () => {
    await enregistrerProfil({ type: 'eleve', niveau: '3e', pays: 'CM', termine: true });
    await monter(<Reviser />);
    await fireEvent.press(screen.getByRole('tab', { name: x.annales.onglet }));
    await waitFor(() => expect(screen.getByText('Maths')).toBeTruthy());
    expect(screen.queryByText(x.annales.maClasse)).toBeNull();
    const champ = () => screen.getByLabelText(x.annales.rechercher);
    expect(screen.queryByRole('button', { name: x.annales.effacerRecherche })).toBeNull();
    await fireEvent.changeText(champ(), 'MATHS');
    expect(screen.getByText('Maths')).toBeTruthy();
    await fireEvent.changeText(champ(), 'zzz');
    expect(screen.queryByText('Maths')).toBeNull();
    expect(screen.getByText(x.annales.aucunResultat.replace('{{q}}', 'zzz'))).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: x.annales.effacerRecherche }));
    expect(champ().props.value).toBe('');
    expect(screen.getByText('Maths')).toBeTruthy();
  });

  it('recherche : trouve aussi un sujet (matière, année) et un concours', async () => {
    await enregistrerProfil({ type: 'concours', termine: true });
    await monter(<Reviser />);
    await fireEvent.press(screen.getByRole('tab', { name: x.annales.onglet }));
    await waitFor(() => expect(screen.getByLabelText(x.annales.rechercher)).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText(x.annales.rechercher), 'physique 2023');
    expect(await screen.findByText('Physique 2023')).toBeTruthy();
    expect(screen.queryByText('Maths 2024')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText(x.annales.rechercher), 'fmsb');
    expect(screen.getByText('FMSB · Concours 1re année')).toBeTruthy();
    expect(screen.queryByText('ENSPY · Concours 1re année')).toBeNull();
  });

  it('recherche : un élève ne voit jamais les sujets ni les concours d\'un autre programme', async () => {
    await enregistrerProfil({ type: 'eleve', niveau: '3e', pays: 'CM', termine: true });
    await monter(<Reviser />);
    await fireEvent.press(screen.getByRole('tab', { name: x.annales.onglet }));
    await waitFor(() => expect(screen.getByText('Maths')).toBeTruthy());
    for (const q of ['physique 2023', 'fmsb', 'enspy', 'biologie', 'concours']) {
      await fireEvent.changeText(screen.getByLabelText(x.annales.rechercher), q);
      expect(screen.queryByText('Physique 2023')).toBeNull();
      expect(screen.queryByText('Maths 2024')).toBeNull();
      expect(screen.queryByText(/FMSB|ENSPY/)).toBeNull();
      expect(screen.queryByText(x.annales.sujetsTrouves)).toBeNull();
      expect(screen.getByText(x.annales.aucunResultat.replace('{{q}}', q))).toBeTruthy();
    }
  });

  it('recherche : un candidat avec son concours ne cherche que dans ce concours', async () => {
    await enregistrerProfil({ type: 'concours', niveau: 'ingenieurs', pays: 'CM', concours: { id: 'c1', sigle: 'ENSPY', nom: 'Concours 1re année' }, termine: true });
    await monter(<Reviser />);
    await fireEvent.press(screen.getByRole('tab', { name: x.annales.onglet }));
    await waitFor(() => expect(screen.getByText('Maths 2024')).toBeTruthy());
    await fireEvent.changeText(screen.getByLabelText(x.annales.rechercher), 'biologie');
    expect(screen.queryByText(/Biologie/)).toBeNull();
    await fireEvent.changeText(screen.getByLabelText(x.annales.rechercher), 'maths');
    expect(screen.getByText('Maths 2024')).toBeTruthy();
  });

  it('candidat aux concours : pas de dossiers de classe', async () => {
    await enregistrerProfil({ type: 'concours', termine: true });
    await monter(<Reviser />);
    await fireEvent.press(screen.getByRole('tab', { name: x.annales.onglet }));
    await waitFor(() => expect(screen.getByText(x.annales.concours)).toBeTruthy());
    expect(screen.queryByText('Maths')).toBeNull();
    expect(mockRpc).not.toHaveBeenCalledWith('class_document_folders', expect.anything());
  });

  it('un concours : ses sujets, badges, filtre par année seulement', async () => {
    mockParams = { id: 'c1', nom: 'ENSPY' };
    await monter(<AnnalesConcours />);
    await waitFor(() => expect(screen.getByText('Maths 2024')).toBeTruthy());
    expect(screen.queryByText(/Biologie/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'ENSPY' })).toBeNull();
    expect(screen.getByText(x.annales.gratuit)).toBeTruthy();
    expect(screen.getByText(x.annales.pass)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '2023' }));
    expect(screen.queryByText('Maths 2024')).toBeNull();
    await fireEvent.press(screen.getByText('Physique 2023'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/annales/sujet', params: { id: '2' } });
  });

  it('dossier de classe : sous-dossiers et documents, sujet et corrigé', async () => {
    mockParams = { id: 'f1', nom: 'Maths' };
    await monter(<AnnalesDossier />);
    await waitFor(() => expect(screen.getByText('Séquence 3 · Collège Privé')).toBeTruthy());
    expect(screen.getByText('Séquence 1')).toBeTruthy();
    // Pastille : documents gratuits restants.
    expect(screen.getByText(x.credits.gratuit)).toBeTruthy();
    // Un document ouvre sa page de détails (comme un concours) ; le lecteur et les crédits viennent ensuite.
    await fireEvent.press(screen.getByText('Séquence 3 · Collège Privé'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/annales/sujet', params: { id: 'd1', kind: 'document', nom: 'Séquence 3 · Collège Privé', cat: 'Maths', corr: 'd1c' } });
    expect(mockDepenser).not.toHaveBeenCalled();
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Séquence 1'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/annales/dossier', params: { id: 'f2', nom: 'Séquence 1' } });
  });

  it('dossier de classe : barre de recherche en haut (documents et sous-dossiers), vide et croix', async () => {
    mockParams = { id: 'f1', nom: 'Maths' };
    await monter(<AnnalesDossier />);
    await waitFor(() => expect(screen.getByText('Séquence 3 · Collège Privé')).toBeTruthy());
    const champ = () => screen.getByLabelText(x.annales.rechercher);
    await fireEvent.changeText(champ(), 'sequence 1');
    expect(screen.getByText('Séquence 1')).toBeTruthy();
    expect(screen.queryByText('Séquence 3 · Collège Privé')).toBeNull();
    await fireEvent.changeText(champ(), 'college');
    expect(screen.getByText('Séquence 3 · Collège Privé')).toBeTruthy();
    expect(screen.queryByText('Séquence 1')).toBeNull();
    await fireEvent.changeText(champ(), 'zzz');
    expect(screen.getByText(x.annales.aucunResultat.replace('{{q}}', 'zzz'))).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: x.annales.effacerRecherche }));
    expect(screen.getByText('Séquence 1')).toBeTruthy();
    expect(screen.getByText('Séquence 3 · Collège Privé')).toBeTruthy();
  });

  it('sujet gratuit : sujet et correction ouverts, source affichée', async () => {
    await lireCatalogue({ rpc: mockRpc } as never);
    mockParams = { id: '1' };
    await monter(<SujetAnnale />);
    await waitFor(() => expect(screen.getByRole('button', { name: x.annales.ouvrirCorrection })).toBeTruthy());
    expect(screen.getByText(x.annales.source.replace('{{ecole}}', 'Polytechnique Yaoundé'))).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: x.annales.ouvrirSujet }));
    // Le choix du temps se fait dans une feuille, pas sur la page.
    expect(router.push).not.toHaveBeenCalled();
    await fireEvent.press(await screen.findByRole('button', { name: x.travail.commencer }));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/document',
      params: expect.objectContaining({ url: 'https://r2/s1.pdf', titre: 'Maths', sujet: '1', kind: 'exam', ref: '1', corrAction: 'exam_correction', corrRef: '1', duree: '10800' }),
    });
    await fireEvent.press(screen.getByRole('button', { name: x.annales.ouvrirCorrection }));
    expect(mockDepenser).toHaveBeenCalledWith('exam_correction', 1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/document',
      params: expect.objectContaining({ url: 'https://r2/c1.pdf', titre: `Maths · ${x.annales.correctionTitre}`, vue: 'correction', sujet: '1' }),
    });
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
  });

  it('sujet payant : prix sur le bouton, crédits insuffisants, vers les offres', async () => {
    mockParams = { id: '2' };
    mockDepenser.mockResolvedValue({ statut: 'insufficient', cout: 5, solde: 2, contenu: null });
    await monter(<SujetAnnale />);
    await waitFor(() => expect(screen.getByRole('button', { name: /5 /})).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: /5 / }));
    expect(mockDepenser).toHaveBeenCalledWith('exam_correction', 2);
    expect(router.push).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: '/document' }));
    await waitFor(() => expect(screen.getByRole('button', { name: x.annales.voirPass })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: x.annales.voirPass }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/offres', params: { declencheur: 'limite' } });
  });

  it('sujet sans correction', async () => {
    mockParams = { id: '3' };
    await monter(<SujetAnnale />);
    await waitFor(() => expect(screen.getByText(x.travail.pasDeCorrigeIA)).toBeTruthy());
  });

  describe('document de classe : crédits et accord', () => {
    const lignes = (gratuits: number) =>
      mockRpc.mockImplementation(async (nom: string) => {
        if (nom === 'my_free_documents_left') return { data: gratuits, error: null };
        if (nom === 'my_unlocked_refs') return { data: ['d1c'], error: null };
        return { data: [], error: null };
      });

    it('déjà ouvert : s’ouvre directement, sans demander d’accord ni redébiter', async () => {
      lignes(0);
      mockParams = { id: 'd1', kind: 'document', nom: 'Séquence 3', corr: 'd1c' };
      await monter(<SujetAnnale />);
      const bouton = await screen.findByRole('button', { name: x.annales.ouvrirCorrection });
      await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('my_unlocked_refs', expect.anything()));
      await fireEvent.press(bouton);
      await waitFor(() => expect(mockDepenser).toHaveBeenCalledWith('document_pdf', 'd1c'));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/document', params: expect.objectContaining({ url: 'https://r2/d1c.pdf', vue: 'correction' }) });
    });

    it('pas encore ouvert et plus de gratuit : l’accord sur le prix est demandé avant tout débit', async () => {
      lignes(0);
      mockParams = { id: 'd1', kind: 'document', nom: 'Séquence 3', corr: 'd2c' };
      await monter(<SujetAnnale />);
      const bouton = await screen.findByRole('button', { name: x.annales.ouvrirCorrection });
      await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('my_unlocked_refs', expect.anything()));
      await fireEvent.press(bouton);
      await waitFor(() => expect(screen.getByRole('button', { name: x.credits.pasMaintenant })).toBeTruthy());
      expect(mockDepenser).not.toHaveBeenCalled();
      expect(router.push).not.toHaveBeenCalled();
    });

    it('le sujet lui-même : feuille du temps, puis ouverture sans accord quand il est déjà ouvert', async () => {
      mockRpc.mockImplementation(async (nom: string) => (nom === 'my_unlocked_refs' ? { data: ['d1'], error: null } : nom === 'my_free_documents_left' ? { data: 0, error: null } : { data: [], error: null }));
      mockParams = { id: 'd1', kind: 'document', nom: 'Séquence 3', cat: 'Maths' };
      await monter(<SujetAnnale />);
      expect(await screen.findByText('Maths')).toBeTruthy();
      expect(screen.getByText(x.annales.enteteSujet)).toBeTruthy();
      await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('my_unlocked_refs', expect.anything()));
      await fireEvent.press(screen.getByRole('button', { name: x.annales.ouvrirSujet }));
      await fireEvent.press(await screen.findByRole('button', { name: x.travail.commencer }));
      await waitFor(() => expect(mockDepenser).toHaveBeenCalledWith('document_pdf', 'd1'));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/document', params: expect.objectContaining({ url: 'https://r2/d1.pdf', kind: 'document', ref: 'd1' }) });
    });
  });

  it('erreur à l’ouverture du sujet', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('hors ligne') });
    mockParams = { id: '1' };
    await monter(<SujetAnnale />);
    await waitFor(() => expect(screen.getByText(x.annales.sujetErreur)).toBeTruthy());
  });
});
