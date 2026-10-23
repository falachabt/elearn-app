import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { fr as x } from '@/i18n/fr';
import { lireDossiers } from '@/services/annales';
import { definirConnectivitePourTest } from '@/services/connectivite';
import { chargerMission } from '@/services/mission';
import { actualiserPlanningProfil, definirTemps } from '@/services/planning';
import { CLE_PROFIL, enregistrerProfil, lireProfil, lireSeriesClasse } from '@/services/profil';
import { signalerModification } from '@/services/reglagesLocaux';
import { lireCours, programmeDu } from '@/services/reviser';

import { attendre, monter } from '../../certification/__tests__/harnais';
import { libelleProfil } from '../../mission/Accueil';
import { ChoixClasse } from '../../ParcoursArrivee';

const mockParams: { type?: string; modifier?: string } = {};
const mockRpc = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissAll: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => cb(), [cb]);
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), drapeauActif: jest.fn(() => true), ecouterDrapeaux: jest.fn(() => () => {}), definirProprietesUtilisateur: jest.fn() }));
jest.mock('@/services/reglagesLocaux', () => ({ signalerModification: jest.fn(async () => {}) }));
jest.mock('@/services/supabase', () => ({
  getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }),
}));

beforeEach(async () => {
  jest.clearAllMocks();
  mockRpc.mockResolvedValue({ data: [], error: null });
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'eleve', niveau: 'Tle', pays: 'CM', termine: true });
  mockParams.type = 'eleve';
  mockParams.modifier = '1';
});

describe('Choix de classe en modification : confirmer sans changement ne touche à rien', () => {
  it('même classe et même pays : aucune écriture, retour', async () => {
    await monter(<ChoixClasse />);
    await attendre(50);
    const avant = await AsyncStorage.getItem(CLE_PROFIL);
    (signalerModification as jest.Mock).mockClear();
    fireEvent.press(screen.getByRole('button', { name: x.classe.enregistrer }));
    await attendre(50);
    // enregistrerProfil signale toujours la modification : pas de signal, pas d'écriture.
    expect(signalerModification).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(CLE_PROFIL)).toBe(avant);
    expect(router.back).toHaveBeenCalled();
  });

  it('autre classe : le profil est écrit', async () => {
    await monter(<ChoixClasse />);
    await attendre(50);
    // Le profil stocké diffère de l'écran : confirmer doit l'écrire.
    await enregistrerProfil({ type: 'eleve', niveau: '2nde', pays: 'CM', termine: true });
    await monter(<ChoixClasse />);
    await attendre(50);
    fireEvent.press(screen.getByRole('button', { name: x.classe.enregistrer }));
    await attendre(50);
    expect(signalerModification).toHaveBeenCalled();
  });
});

// Issue #74, lot C : en modification, le changement de classe ou de programme est interdit hors ligne
// (le planning et le pack sont recalculés côté serveur). La feuille du bas « Tu es hors ligne »
// l'explique et rien n'est écrit. L'arrivée (première classe) n'est pas concernée par la garde.
describe('Garde hors ligne du changement de classe (lot C)', () => {
  const couperReseau = () => definirConnectivitePourTest({ connecte: false, internet: false, backend: false, enVerification: false });

  it('hors ligne : Enregistrer ouvre la feuille et n’écrit rien', async () => {
    couperReseau();
    await monter(<ChoixClasse />);
    await attendre(50);
    const avant = await AsyncStorage.getItem(CLE_PROFIL);
    (signalerModification as jest.Mock).mockClear();
    fireEvent.press(screen.getByRole('button', { name: x.classe.enregistrer }));
    await attendre(50);
    expect(screen.getByText(x.classe.horsLigneTitre)).toBeTruthy();
    expect(screen.getByText(x.classe.horsLigneTexte)).toBeTruthy();
    expect(signalerModification).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(CLE_PROFIL)).toBe(avant);
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('hors ligne mais simple arrivée (pas de modification) : la garde ne bloque pas', async () => {
    mockParams.modifier = undefined;
    couperReseau();
    await monter(<ChoixClasse />);
    await attendre(50);
    (signalerModification as jest.Mock).mockClear();
    fireEvent.press(screen.getByRole('button', { name: x.classe.continuer }));
    await attendre(50);
    expect(screen.queryByText(x.classe.horsLigneTitre)).toBeNull();
    expect(signalerModification).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/premier-resultat');
  });

  it('en ligne : la feuille ne monte pas et le changement passe comme avant', async () => {
    await monter(<ChoixClasse />);
    await attendre(50);
    // Le profil stocké est Tle ; choisir 3e crée un vrai changement à enregistrer.
    fireEvent.press(screen.getByRole('button', { name: '3e' }));
    await attendre(20);
    (signalerModification as jest.Mock).mockClear();
    fireEvent.press(screen.getByRole('button', { name: x.classe.enregistrer }));
    await attendre(50);
    expect(screen.queryByText(x.classe.horsLigneTitre)).toBeNull();
    expect(signalerModification).toHaveBeenCalled();
    expect((await lireProfil())?.niveau).toBe('3e');
  });
});

describe('Choix et filtrage de la série (lycée)', () => {
  it('affiche les séries au lycée (plusieurs séries), cache le sélecteur au collège (une série technique), et enregistre la série choisie', async () => {
    mockRpc.mockImplementation(async (fn: string, args?: Record<string, unknown>) => {
      if (fn === 'class_series') {
        if (args?.p_level === 'Tle') {
          return {
            data: [
              { series_id: 's-a', name: 'Série A', courses: 6 },
              { series_id: 's-c', name: 'Série C', courses: 12 },
              { series_id: 's-d', name: 'Série D', courses: 13 },
            ],
            error: null,
          };
        }
        return { data: [{ series_id: 's-3e', name: '3e', courses: 11 }], error: null };
      }
      if (fn === 'my_study_plan') {
        return { data: { status: 'ready', minutes_per_day: 45 }, error: null };
      }
      return { data: null, error: null };
    });

    await monter(<ChoixClasse />);
    await attendre(50);
    expect(screen.getByText(x.classe.taSerie)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Série C' })).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Série C' }));
    await attendre(20);
    await fireEvent.press(screen.getByRole('button', { name: x.classe.enregistrer }));
    await attendre(50);

    const p = await lireProfil();
    expect(p?.serie).toEqual({ id: 's-c', nom: 'Série C' });
    expect(libelleProfil(p)).toBe('Tle C');
    expect(mockRpc).toHaveBeenCalledWith('study_plan_set_time', {
      p_level: 'Tle',
      p_country: 'CM',
      p_minutes: 45,
      p_series: 's-c',
    });

    // Passer en 3e cache les pastilles de série (une seule série technique).
    await fireEvent.press(screen.getByRole('button', { name: '3e' }));
    await attendre(50);
    expect(screen.queryByText(x.classe.taSerie)).toBeNull();
  });

  it('propage p_series aux cours, à la mission, aux dossiers d’annales et au planning', async () => {
    const rpc = jest.fn(async (fn: string) => {
      if (fn === 'class_series') return { data: [{ series_id: 's-d', name: 'Série D', courses: 13 }], error: null };
      if (fn === 'revision_courses') return { data: [], error: null };
      if (fn === 'daily_mission_sized') return { data: [], error: null };
      if (fn === 'class_document_folders') return { data: [], error: null };
      if (fn === 'study_plan_set_time') return { data: { status: 'ready' }, error: null };
      if (fn === 'my_study_plan') return { data: { status: 'ready', minutes_per_day: 30 }, error: null };
      return { data: null, error: null };
    });
    const client = { rpc } as unknown as Parameters<typeof chargerMission>[0];

    const series = await lireSeriesClasse({ rpc }, 'Tle', 'CM');
    expect(series).toEqual([{ id: 's-d', nom: 'Série D', cours: 13 }]);

    const prog = programmeDu({ type: 'eleve', niveau: 'Tle', pays: 'CM', serie: { id: 's-d', nom: 'Série D' } });
    expect(prog).toEqual({ niveau: 'Tle', pays: 'CM', concours: null, serie: 's-d' });

    await lireCours(client, prog);
    expect(rpc).toHaveBeenCalledWith('revision_courses', { p_level: 'Tle', p_country: 'CM', p_series: 's-d' });

    await chargerMission(client, { niveau: 'Tle', pays: 'CM', serie: 's-d', vraiFaux: { vrai: 'Vrai', faux: 'Faux' }, jour: '2026-10-19' });
    expect(rpc).toHaveBeenCalledWith('daily_mission_sized', {
      p_level: 'Tle',
      p_country: 'CM',
      p_day: '2026-10-19',
      p_questions: 20,
      p_series: 's-d',
    });

    await lireDossiers(client, { niveau: 'Tle', pays: 'CM', serie: 's-d' });
    expect(rpc).toHaveBeenCalledWith('class_document_folders', { p_level: 'Tle', p_country: 'CM', p_parent: null, p_series: 's-d' });

    await definirTemps(client, 'Tle', 'CM', 60, 's-d');
    expect(rpc).toHaveBeenCalledWith('study_plan_set_time', { p_level: 'Tle', p_country: 'CM', p_minutes: 60, p_series: 's-d' });

    await actualiserPlanningProfil({ rpc } as unknown as Parameters<typeof actualiserPlanningProfil>[0], 'Tle', 'CM', 's-d');
    expect(rpc).toHaveBeenCalledWith('study_plan_set_time', { p_level: 'Tle', p_country: 'CM', p_minutes: 30, p_series: 's-d' });
  });
});

