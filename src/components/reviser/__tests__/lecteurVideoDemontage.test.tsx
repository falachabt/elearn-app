// Régression du 12/11/2026 (suivi d'erreurs) : au démontage du lecteur, la libération du lecteur natif
// (release) passait AVANT le nettoyage de focus, qui relisait ensuite currentTime puis appelait pause()
// sur un lecteur libéré — « shared object that was already released » (Android), NotFoundException
// (iOS). L'exception sautait le versement du temps visionné et la synchro des positions. La fermeture
// doit se faire entièrement avant release(), et plus rien ne doit toucher le lecteur après.
import { act, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/theme/ThemeProvider';

import { LecteurVideo } from '../LecteurVideo';

type Ecouteur = (e: Record<string, unknown>) => void;

// Lecteur simulé fidèle au natif : après release(), toute lecture ou commande lève.
const mockJournal: string[] = [];
const mockEcouteurs: Record<string, Ecouteur> = {};
const mockPlayer = (() => {
  let libere = false;
  const garde = (nom: string) => {
    if (libere) throw new Error(`${nom}: shared object that was already released`);
  };
  return {
    reinitialiser: () => {
      libere = false;
    },
    timeUpdateEventInterval: 0,
    get currentTime() {
      garde('currentTime');
      return 42;
    },
    set currentTime(_v: number) {
      garde('currentTime');
    },
    get duration() {
      garde('duration');
      return 120;
    },
    addListener: jest.fn((nom: string, cb: Ecouteur) => {
      mockEcouteurs[nom] = cb;
      return { remove: jest.fn() };
    }),
    replace: jest.fn(() => garde('replace')),
    play: jest.fn(() => garde('play')),
    pause: jest.fn(() => {
      garde('pause');
      mockJournal.push('pause');
    }),
    release: jest.fn(() => {
      libere = true;
      mockJournal.push('release');
    }),
  };
})();
jest.mock('expo-video', () => ({
  createVideoPlayer: jest.fn(() => mockPlayer),
  VideoView: () => null,
}));

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    router: { back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) },
    useLocalSearchParams: () => ({ cours: '42', video: 'v1', nom: 'Chapitre gravitation', matiere: 'Physique' }),
    useFocusEffect: (cb: () => void | (() => void)) => {
      useEffect(() => cb(), [cb]);
    },
  };
});

jest.mock('@/session/SessionProvider', () => ({
  useSessionPrete: () => true,
  useSession: () => ({ statut: 'prete', session: { user: { id: 'u1', is_anonymous: false } }, erreur: null }),
}));

jest.mock('@/services/supabase', () => ({ getSupabase: () => ({}) }));

const mockVideos = [
  { id: 'v1', cours: 42, titre: 'Les lois de Kepler', numero: 1, dureeS: 120, url: 'https://exemple.test/v1.mp4', url1080: null, miniature: null, ordre: 0 },
];
const mockNoterPosition = jest.fn(async () => {
  mockJournal.push('position');
  return { positionS: 42, dureeS: 120, terminee: false, quand: 0, cours: 42 };
});
const mockSynchroniser = jest.fn(async () => {
  mockJournal.push('synchro');
  return {};
});
jest.mock('@/services/videos', () => ({
  formaterDuree: (s?: number | null) => `${Math.floor((s ?? 0) / 60)}:${String(Math.floor((s ?? 0) % 60)).padStart(2, '0')}`,
  lireTelechargees: jest.fn(async () => ({})),
  lireVideos: jest.fn(async () => mockVideos),
  marquerTerminee: jest.fn(async () => undefined),
  noterDerniereVideo: jest.fn(async () => undefined),
  noterPosition: (...args: unknown[]) => mockNoterPosition(...(args as [])),
  supprimerVideoTelechargee: jest.fn(async () => undefined),
  synchroniserSuivis: (...args: unknown[]) => mockSynchroniser(...(args as [])),
  telechargerVideo: jest.fn(async () => undefined),
  telechargerVideos: jest.fn(async () => undefined),
  videoLocale: jest.fn(() => null),
}));

jest.mock('@/services/entrainement', () => ({
  lireEntrainement: jest.fn(async () => ({ quiz: [], exercices: [] })),
  lireProgresChapitres: jest.fn(async () => ({})),
}));

const mockTemps = jest.fn(async (_e: unknown) => {
  mockJournal.push('temps');
});
jest.mock('@/services/activite', () => ({ enregistrerTempsActivite: (e: unknown) => mockTemps(e) }));

jest.mock('@/services/credits', () => ({ peutVoir: jest.fn(async () => true) }));
jest.mock('@/components/credits/useOuverts', () => {
  const ouverts = new Set(['v1']);
  const acces = {
    ouverts,
    gratuits: 0,
    relire: async () => undefined,
    deja: () => true,
    sansFrais: () => true,
    etat: () => 'deja',
    cout: 3,
  };
  return { useOuverts: () => acces };
});
jest.mock('@/components/credits/useDepenseCredits', () => ({ useDepenseCredits: () => ({ lancer: jest.fn(), feuilles: null }) }));

jest.mock('@/components/arrivee/MiniTest', () => {
  const { Pressable: P, Text: T } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    BoutonFermer: ({ libelle, onPress }: { libelle: string; onPress: () => void }) => (
      <P accessibilityRole="button" accessibilityLabel={libelle} onPress={onPress}>
        <T>{libelle}</T>
      </P>
    ),
  };
});

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } };

beforeEach(() => {
  jest.clearAllMocks();
  mockJournal.length = 0;
  mockPlayer.reinitialiser();
});

describe('Lecteur vidéo — démontage', () => {
  it('ferme tout (position, temps visionné, synchro, pause) avant release, puis ne touche plus le lecteur', async () => {
    const maintenant = jest.spyOn(Date, 'now');
    maintenant.mockReturnValue(1_000_000);
    const vue = await render(
      <SafeAreaProvider initialMetrics={metriques}>
        <ThemeProvider reglage="clair">
          <LecteurVideo />
        </ThemeProvider>
      </SafeAreaProvider>,
    );
    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalledWith({ uri: 'https://exemple.test/v1.mp4' }));

    // 30 s de lecture, segment encore ouvert au moment de quitter l'écran.
    await act(async () => mockEcouteurs.playingChange({ isPlaying: true }));
    maintenant.mockReturnValue(1_030_000);
    mockJournal.length = 0;
    mockSynchroniser.mockClear();

    await vue.unmount();

    expect(mockNoterPosition).toHaveBeenCalledWith('v1', 42, 42, 120);
    expect(mockTemps).toHaveBeenCalledWith(expect.objectContaining({ type: 'video', dureeS: 30, titre: 'Les lois de Kepler' }));
    expect(mockSynchroniser).toHaveBeenCalledTimes(1);
    expect(mockJournal.indexOf('release')).toBe(mockJournal.length - 1);
    expect(mockJournal.indexOf('pause')).toBeLessThan(mockJournal.indexOf('release'));
    expect(mockPlayer.release).toHaveBeenCalledTimes(1);
    maintenant.mockRestore();
  });
});
