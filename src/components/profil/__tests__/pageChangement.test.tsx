import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';

import EcranChoisirCertification from '@/app/profil/certification';
import { fr as x } from '@/i18n/fr';
import { lireMemoireProfil } from '@/services/changementProfil';
import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import { enregistrerProfil, lireProfil } from '@/services/profil';

import { attendre, monter } from '../../certification/__tests__/harnais';
import { PageChangementParcours } from '../PageChangementParcours';

const mockParams: { onglet?: string; source?: string } = {};
const mockRedirect = jest.fn();
const mockRpc = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissAll: jest.fn(), canGoBack: jest.fn(() => true) },
  Redirect: (props: unknown) => {
    mockRedirect(props);
    return null;
  },
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => cb(), [cb]);
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), drapeauActif: jest.fn(() => true), ecouterDrapeaux: jest.fn(() => () => {}), definirProprietesUtilisateur: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-profil' }));
jest.mock('../../credits/CompteurCredits', () => ({ CompteurCredits: () => null }));
jest.mock('../../../services/reglagesLocaux', () => ({ signalerModification: jest.fn(async () => {}) }));
jest.mock('@/session/SessionProvider', () => ({ useSessionPrete: () => 'u1' }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }) }));

const FILIERES = [
  { code: 'ingenieurs', name_fr: 'Écoles d’ingénieurs', name_en: 'Engineering', icon: 'construct-outline', contests: 2 },
  { code: 'sante', name_fr: 'Médecine et santé', name_en: 'Health', icon: 'medkit-outline', contests: 1 },
];
const CONCOURS = [
  { contest_id: 'c1', sigle: 'ENSPY', school: 'Polytechnique Yaoundé', name: 'Entrée 1re année', cycle: 'Premier cycle', city: 'Yaoundé', next_date: null, papers: 22, lessons: 300 },
];

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockParams.onglet = undefined;
  mockParams.source = undefined;
  mockRpc.mockImplementation(async (nom: string) => {
    if (nom === 'contest_track_list') return { data: FILIERES, error: null };
    if (nom === 'track_contests') return { data: CONCOURS, error: null };
    if (nom === 'class_series') return { data: [{ series_id: 's-d', name: 'Série D', courses: 13 }], error: null };
    if (nom === 'my_study_plan') return { data: { status: 'ready', minutes_per_day: 30 }, error: null };
    return { data: [], error: null };
  });
  await enregistrerProfil({ type: 'eleve', niveau: 'Tle', pays: 'CM', termine: true });
  definirApi(creerApiFausse().api);
});

// Issue #125 : page de changement unique à trois onglets.
describe('Page de changement de parcours', () => {
  it('sans paramètre, l’onglet ouvert est celui de la famille actuelle, et les trois onglets sont là', async () => {
    await monter(<PageChangementParcours />);
    expect(await screen.findByText(x.classe.taClasse)).toBeTruthy();
    expect(screen.getByRole('tab', { name: x.profilChoix.typeSecondaire })).toBeTruthy();
    expect(screen.getByRole('tab', { name: x.profilChoix.typeConcours })).toBeTruthy();
    expect(screen.getByRole('tab', { name: x.profilChoix.certificationTitre })).toBeTruthy();
  });

  it('barre d’onglets : le point soleil marque la famille active, pas l’onglet consulté', async () => {
    await monter(<PageChangementParcours />);
    expect(await screen.findByText(x.classe.taClasse)).toBeTruthy();
    expect(within(screen.getByRole('tab', { name: x.profilChoix.typeSecondaire })).getByTestId('onglets-point-marque')).toBeTruthy();
    fireEvent.press(screen.getByRole('tab', { name: x.profilChoix.typeConcours }));
    expect(await screen.findByText(x.concours.filiereTitre)).toBeTruthy();
    // L'onglet consulté a changé, le point reste sur la famille active (Secondaire).
    expect(within(screen.getByRole('tab', { name: x.profilChoix.typeSecondaire })).getByTestId('onglets-point-marque')).toBeTruthy();
    expect(within(screen.getByRole('tab', { name: x.profilChoix.typeConcours })).queryByTestId('onglets-point-marque')).toBeNull();
  });

  it('le paramètre onglet ouvre directement l’onglet demandé, sans basculer le profil', async () => {
    mockParams.onglet = 'certification';
    await monter(<PageChangementParcours />);
    expect(await screen.findByText('TOEIC Listening and Reading')).toBeTruthy();
    expect((await lireProfil())?.type).toBe('eleve');
  });

  it('changer d’onglet change le contenu, jamais le profil', async () => {
    await monter(<PageChangementParcours />);
    expect(await screen.findByText(x.classe.taClasse)).toBeTruthy();
    fireEvent.press(screen.getByRole('tab', { name: x.profilChoix.typeConcours }));
    expect(await screen.findByText(x.concours.filiereTitre)).toBeTruthy();
    fireEvent.press(screen.getByRole('tab', { name: x.profilChoix.typeSecondaire }));
    expect(await screen.findByText(x.classe.taClasse)).toBeTruthy();
    expect((await lireProfil())?.type).toBe('eleve');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('adoption intra-famille : changer de classe dans l’onglet Secondaire suit le flux actuel (Enregistrer)', async () => {
    await monter(<PageChangementParcours />);
    expect(await screen.findByText(x.classe.taClasse)).toBeTruthy();
    expect(screen.queryByText(x.profilChoix.passerSecondaireTitre)).toBeNull();
    // Le pré-remplissage depuis le profil est asynchrone : attendre qu'il se pose (Tle sélectionnée)
    // avant de toucher aux pastilles, sinon il écrase le choix du test.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tle' }).props.accessibilityState?.selected).toBe(true), { timeout: 5000 });
    fireEvent.press(screen.getByRole('button', { name: '3e' }));
    await attendre(30);
    fireEvent.press(screen.getByRole('button', { name: x.classe.enregistrer }));
    await waitFor(async () => expect((await lireProfil())?.niveau).toBe('3e'), { timeout: 5000 });
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('adoption inter-familles vers la certification : conséquences affichées, confirmation requise, profils permutés', async () => {
    mockParams.onglet = 'certification';
    await monter(<PageChangementParcours />);
    fireEvent.press(await screen.findByRole('radio', { name: /TOEIC Listening and Reading/ }, { timeout: 5000 }));
    await attendre(30);
    fireEvent.press(await screen.findByRole('button', { name: x.certification.continuer }));
    // Le bloc d'adoption est dans la page : titre et texte de conséquences repris de l'ancien écran.
    expect(await screen.findByText(x.profilChoix.passerToeicTitre, {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByText(x.profilChoix.passerToeicTexte)).toBeTruthy();
    // Rien n'a encore basculé.
    expect((await lireProfil())?.type).toBe('eleve');
    fireEvent.press(screen.getByRole('button', { name: x.profilChoix.passerToeicBouton }));
    await waitFor(async () => expect((await lireProfil())?.type).toBe('certification'), { timeout: 5000 });
    expect(router.replace).toHaveBeenCalledWith('/');
    expect((await lireMemoireProfil()).secondaire).toMatchObject({ type: 'eleve', niveau: 'Tle' });
  });

  it('adoption inter-familles en échec d’écriture : « Changement impossible », le profil reste en place', async () => {
    mockParams.onglet = 'certification';
    await monter(<PageChangementParcours />);
    fireEvent.press(await screen.findByRole('radio', { name: /TOEIC Listening and Reading/ }, { timeout: 5000 }));
    await attendre(30);
    fireEvent.press(await screen.findByRole('button', { name: x.certification.continuer }));
    expect(await screen.findByText(x.profilChoix.passerToeicTitre, {}, { timeout: 5000 })).toBeTruthy();
    // Même précaution que le test du service : pas de jest.spyOn sur AsyncStorage (il casse les écritures suivantes).
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disque plein'));
    fireEvent.press(screen.getByRole('button', { name: x.profilChoix.passerToeicBouton }));
    expect(await screen.findByText(x.profilChoix.erreurTitre, {}, { timeout: 5000 })).toBeTruthy();
    expect((await lireProfil())?.type).toBe('eleve');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('adoption inter-familles vers le secondaire depuis un concours : le bloc propose les conséquences, la confirmation permute', async () => {
    await enregistrerProfil({ type: 'concours', niveau: 'ingenieurs', pays: 'CM', concours: { id: 'c1', sigle: 'ENSPY', nom: 'Entrée 1re année', ville: 'Yaoundé' }, termine: true });
    mockParams.onglet = 'secondaire';
    await monter(<PageChangementParcours />);
    expect(await screen.findByText(x.profilChoix.passerSecondaireTitre, {}, { timeout: 5000 })).toBeTruthy();
    expect(screen.getByText(x.profilChoix.consequencesDepuisConcours)).toBeTruthy();
    // Le formulaire classe garde sa valeur par défaut : la filière du profil concours ne doit pas
    // y être recopiée comme niveau (régression vue en captures le 25/10/2026).
    await waitFor(() => expect(screen.getByRole('button', { name: '3e' }).props.accessibilityState?.selected).toBe(true), { timeout: 5000 });
    fireEvent.press(screen.getByRole('button', { name: x.profilChoix.passerSecondaireBouton }));
    await waitFor(async () => expect((await lireProfil())?.type).toBe('eleve'), { timeout: 5000 });
    expect((await lireProfil())?.niveau).toBe('3e');
    expect((await lireMemoireProfil()).secondaire).toMatchObject({ type: 'concours', niveau: 'ingenieurs' });
    await attendre(10);
  });

  it('l’ancienne route /profil/certification redirige vers l’onglet certification de la page', async () => {
    await monter(<EcranChoisirCertification />);
    await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith({ href: { pathname: '/profil/changer', params: { onglet: 'certification' } } }), { timeout: 5000 });
  });
});
