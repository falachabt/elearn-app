import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/theme/ThemeProvider';

import { LecteurVideo } from '../LecteurVideo';

// Régression du 26/10/2026 (signalée par Benny en test réel) : le bouton retour du lecteur faisait
// router.navigate vers la page du cours — un navigate EMPILE un écran au lieu de dépiler, donc chaque
// aller-retour page du cours ↔ lecteur ajoutait des écrans et le retour alternait entre les deux en
// boucle infinie. Le retour doit dépiler (router.back) vers l'écran d'origine réel — page du cours,
// accueil « Reprendre » ou Mes vidéos — et ne retomber sur le chapitre en replace que sans historique.
//
// Les jest.fn du routeur vivent DANS la fabrique du mock : une fabrique jest.mock s'exécute dès le
// premier import du module, avant les const du fichier — y référencer des variables externes y
// donnerait undefined (piège déjà rencontré dans ce dépôt).

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    router: {
      back: jest.fn(),
      replace: jest.fn(),
      navigate: jest.fn(),
      push: jest.fn(),
      canGoBack: jest.fn(() => true),
    },
    useLocalSearchParams: () => ({ cours: '42', video: 'v1', nom: 'Chapitre gravitation', matiere: 'Physique' }),
    useFocusEffect: (cb: () => void | (() => void)) => {
      useEffect(() => cb(), [cb]);
    },
  };
});

jest.mock('expo-video', () => ({
  createVideoPlayer: jest.fn(() => ({
    timeUpdateEventInterval: 0,
    currentTime: 0,
    duration: 0,
    playing: false,
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    replace: jest.fn(),
    pause: jest.fn(),
    play: jest.fn(),
    release: jest.fn(),
  })),
  VideoView: () => null,
}));

// Session non prête : l'écran ne charge rien, mais son en-tête (avec le bouton retour) est rendu.
jest.mock('@/session/SessionProvider', () => ({ useSessionPrete: () => false }));

jest.mock('@/services/supabase', () => ({ getSupabase: () => ({}) }));

jest.mock('@/services/videos', () => ({
  formaterDuree: (s?: number | null) => `${Math.floor((s ?? 0) / 60)}:${String(Math.floor((s ?? 0) % 60)).padStart(2, '0')}`,
  lireTelechargees: jest.fn(async () => ({})),
  lireVideos: jest.fn(async () => []),
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

const mockRouter = router as unknown as {
  back: jest.Mock;
  replace: jest.Mock;
  navigate: jest.Mock;
  push: jest.Mock;
  canGoBack: jest.Mock;
};

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } };

const monter = () =>
  render(
    <SafeAreaProvider initialMetrics={metriques}>
      <ThemeProvider reglage="clair">
        <LecteurVideo />
      </ThemeProvider>
    </SafeAreaProvider>,
  );

describe('LecteurVideo — navigation retour', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.canGoBack.mockReturnValue(true);
  });

  it('dépile vers l’écran d’origine quand l’historique le permet (pas de boucle)', async () => {
    await monter();
    fireEvent.press(screen.getByLabelText('Retour au cours'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('sans historique (lien direct), repli en replace vers la page du cours — jamais navigate', async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    await monter();
    fireEvent.press(screen.getByLabelText('Retour au cours'));
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/cours/chapitre',
      params: { id: '42', nom: 'Chapitre gravitation', matiere: 'Physique' },
    });
  });
});
