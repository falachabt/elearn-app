// Verrou crédits du lecteur vidéo (26/10/2026) : aucune source n'est chargée tant que l'accès n'est pas
// établi — vidéo déjà débloquée (ou regardée avant les crédits), pass illimité, copie téléchargée, ou
// déblocage par le parcours existant (la première ouverture est la gratuite de découverte, consommée
// côté serveur). Un refus laisse un panneau de déblocage, jamais un lecteur muet sur une vidéo payante.
import { render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/theme/ThemeProvider';

import { LecteurVideo } from '../LecteurVideo';

const mockPlayer = {
  timeUpdateEventInterval: 0,
  currentTime: 0,
  duration: 0,
  playing: false,
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  replace: jest.fn(),
  pause: jest.fn(),
  play: jest.fn(),
  release: jest.fn(),
};
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
  { id: 'v2', cours: 42, titre: 'Les lentilles', numero: 2, dureeS: 90, url: 'https://exemple.test/v2.mp4', url1080: null, miniature: null, ordre: 1 },
];
jest.mock('@/services/videos', () => ({
  formaterDuree: (s?: number | null) => `${Math.floor((s ?? 0) / 60)}:${String(Math.floor((s ?? 0) % 60)).padStart(2, '0')}`,
  lireTelechargees: jest.fn(async () => ({})),
  lireVideos: jest.fn(async () => mockVideos),
  marquerTerminee: jest.fn(async () => undefined),
  noterDerniereVideo: jest.fn(async () => undefined),
  noterPosition: jest.fn(async () => ({ positionS: 0, dureeS: null, terminee: false, quand: 0, cours: 42 })),
  supprimerVideoTelechargee: jest.fn(async () => undefined),
  synchroniserSuivis: jest.fn(async () => ({})),
  telechargerVideo: jest.fn(async () => undefined),
  telechargerVideos: jest.fn(async () => undefined),
  videoLocale: jest.fn(() => null),
}));

jest.mock('@/services/entrainement', () => ({
  lireEntrainement: jest.fn(async () => ({ quiz: [], exercices: [] })),
  lireProgresChapitres: jest.fn(async () => ({})),
}));
jest.mock('@/services/activite', () => ({ enregistrerTempsActivite: jest.fn(async () => undefined) }));

const mockPeutVoir = jest.fn();
jest.mock('@/services/credits', () => ({ peutVoir: (...args: unknown[]) => mockPeutVoir(...args) }));

const mockAcces = jest.fn();
jest.mock('@/components/credits/useOuverts', () => ({ useOuverts: () => mockAcces() }));
const mockLancer = jest.fn();
jest.mock('@/components/credits/useDepenseCredits', () => ({ useDepenseCredits: () => ({ lancer: mockLancer, feuilles: null }) }));

function donnerAcces(etat: 'payant' | 'gratuit' | 'deja' | 'inclus', ouverts: string[] = []) {
  const set = new Set(ouverts);
  mockAcces.mockReturnValue({
    ouverts: set,
    gratuits: etat === 'gratuit' ? 1 : 0,
    relire: jest.fn(async () => undefined),
    deja: (r: string) => set.has(r),
    sansFrais: () => etat !== 'payant',
    etat: () => etat,
    cout: 3,
  });
}

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

const arbre = () => (
  <SafeAreaProvider initialMetrics={metriques}>
    <ThemeProvider reglage="clair">
      <LecteurVideo />
    </ThemeProvider>
  </SafeAreaProvider>
);

const rendre = () => render(arbre());

beforeEach(() => {
  jest.clearAllMocks();
  mockPeutVoir.mockResolvedValue(false);
  mockLancer.mockResolvedValue(null);
  donnerAcces('payant');
});

describe('Lecteur vidéo — verrou crédits', () => {
  it('vidéo verrouillée, parcours fermé : aucune source chargée, panneau de déblocage', async () => {
    rendre();
    await waitFor(() => expect(screen.getByText('Vidéo verrouillée')).toBeTruthy());
    expect(mockLancer).toHaveBeenCalledWith('course_video', 'v1', { deja: false });
    expect(mockPlayer.replace).not.toHaveBeenCalled();
    expect(screen.getByText('Débloquer la vidéo')).toBeTruthy();
    // La playlist annonce le verrou sur les parties (la courante comme les autres).
    expect(screen.getAllByText('À débloquer').length).toBeGreaterThanOrEqual(1);
  });

  it('refus après une relecture des déblocages pendant la feuille : le panneau s’affiche quand même', async () => {
    // Régression vécue en capture réelle (26/10/2026) : la relecture des déblocages remplace l'ensemble
    // `ouverts` pendant que la feuille de coût attend la réponse — le nettoyage de l'effet de garde
    // jetait le verdict, et la vidéo restait en limbe (ni panneau, ni lecture, contrôles morts).
    let resoudre: (v: null) => void = () => undefined;
    mockLancer.mockImplementation(() => new Promise((r) => { resoudre = r; }));
    const { rerender } = await rendre();
    await waitFor(() => expect(mockLancer).toHaveBeenCalledTimes(1));
    donnerAcces('payant'); // même contenu, nouvel ensemble : l'effet de garde tourne
    rerender(arbre());
    resoudre(null); // l'élève ferme la feuille sans débloquer
    await waitFor(() => expect(screen.getByText('Vidéo verrouillée')).toBeTruthy());
    expect(mockPlayer.replace).not.toHaveBeenCalled();
  });

  it('découverte gratuite disponible : déblocage direct, la vidéo se charge', async () => {
    donnerAcces('gratuit');
    mockLancer.mockResolvedValue({ statut: 'free', cout: 0, solde: 40, contenu: null });
    rendre();
    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalledWith({ uri: 'https://exemple.test/v1.mp4' }));
    expect(mockLancer).toHaveBeenCalledWith('course_video', 'v1', { deja: true });
    expect(screen.queryByText('Vidéo verrouillée')).toBeNull();
  });

  it('vidéo déjà débloquée : lecture directe, aucune dépense demandée', async () => {
    donnerAcces('deja', ['v1']);
    mockPeutVoir.mockResolvedValue(true);
    rendre();
    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalledWith({ uri: 'https://exemple.test/v1.mp4' }));
    expect(mockLancer).not.toHaveBeenCalled();
  });

  it('pass illimité : le serveur confirme, lecture directe, aucune dépense', async () => {
    donnerAcces('inclus');
    mockPeutVoir.mockResolvedValue(true);
    rendre();
    await waitFor(() => expect(mockPlayer.replace).toHaveBeenCalledWith({ uri: 'https://exemple.test/v1.mp4' }));
    expect(mockLancer).not.toHaveBeenCalled();
  });
});
