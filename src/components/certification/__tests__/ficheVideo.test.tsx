import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import { FICHE_TEST, JOUR, MOTS_TEST, REVISION_TEST } from '@/services/certification/__tests__/fixturesRevision';
import { chargerVideoNotion } from '@/services/certification/videoNotion';
import { enregistrerProfil } from '@/services/profil';

import { FicheNotion } from '../FicheNotion';
import { monter } from './harnais';

const t = fr.certification;

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    useEffect(() => cb(), [cb]);
  },
  useLocalSearchParams: () => ({ id: 'n-prepo', source: 'liste' }),
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), definirProprietesUtilisateur: jest.fn(), drapeauActif: jest.fn(() => true), ecouterDrapeaux: jest.fn(() => () => {}) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-1' }));
jest.mock('expo-audio', () => ({ createAudioPlayer: jest.fn() }));

const mockEcouteurs: Record<string, (e?: unknown) => void> = {};
const mockLecteur = {
  addListener: jest.fn((nom: string, cb: (e?: unknown) => void) => {
    mockEcouteurs[nom] = cb;
    return { remove: jest.fn() };
  }),
  play: jest.fn(),
  pause: jest.fn(),
  release: jest.fn(),
  playing: false,
  duration: 140,
  currentTime: 0,
  timeUpdateEventInterval: 0,
};
jest.mock('expo-video', () => ({
  createVideoPlayer: jest.fn(() => mockLecteur),
  VideoView: () => null,
}));
jest.mock('@/services/certification/videoNotion', () => ({ chargerVideoNotion: jest.fn() }));

const VIDEO = { code: 'prepo', url: 'https://medias.test/toeic/videos/prepo/video-720.mp4', miniature: 'https://medias.test/toeic/videos/prepo/miniature.jpg', dureeS: 140 };

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: true });
  definirApi(creerApiFausse({ revision: REVISION_TEST, carnet: MOTS_TEST, fiche: FICHE_TEST }).api);
  void JOUR;
});
afterEach(() => definirApi(null));

describe('C5v · Fiche de notion avec vidéo', () => {
  it('maquette 1 : la vidéo seule, le texte de la fiche est replié derrière « Lire la fiche »', async () => {
    (chargerVideoNotion as jest.Mock).mockResolvedValue(VIDEO);
    await monter(<FicheNotion />);
    expect(await screen.findByText(t.fiche.video.etiquette)).toBeTruthy();
    expect(screen.getByText(t.fiche.video.aideDuree.replace('{{duree}}', '2:20'))).toBeTruthy();
    expect(screen.getByText(t.fiche.video.lireFiche)).toBeTruthy();
    expect(screen.queryByText(t.fiche.regle)).toBeNull();
    expect(screen.queryByText(t.fiche.piege)).toBeNull();
    // Le bouton d’entraînement reste fixe en bas.
    expect(screen.getByText(t.fiche.entrainer)).toBeTruthy();
  });

  it('maquette 3 : un appui déplie la fiche, un second la replie, et chaque bascule est suivie', async () => {
    (chargerVideoNotion as jest.Mock).mockResolvedValue(VIDEO);
    await monter(<FicheNotion />);
    await fireEvent.press(await screen.findByText(t.fiche.video.lireFiche));
    expect(await screen.findByText(t.fiche.regle)).toBeTruthy();
    expect(screen.getByText(t.fiche.piege)).toBeTruthy();
    expect(screen.getByText(t.fiche.video.masquerFiche)).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('cert_notion_sheet_toggled', { notion: 'prepo', ouverte: true });
    await fireEvent.press(screen.getByText(t.fiche.video.masquerFiche));
    expect(screen.queryByText(t.fiche.regle)).toBeNull();
    expect(suivre).toHaveBeenCalledWith('cert_notion_sheet_toggled', { notion: 'prepo', ouverte: false });
  });

  it('maquette 2 : aucun flux avant l’appui, puis lecture ; départ et fin suivis une fois', async () => {
    (chargerVideoNotion as jest.Mock).mockResolvedValue(VIDEO);
    const { createVideoPlayer } = jest.requireMock('expo-video') as { createVideoPlayer: jest.Mock };
    await monter(<FicheNotion />);
    const lancer = await screen.findByRole('button', { name: /^Lancer la vidéo/ });
    expect(createVideoPlayer).not.toHaveBeenCalled();
    await fireEvent.press(lancer);
    expect(createVideoPlayer).toHaveBeenCalledWith(VIDEO.url);
    expect(mockLecteur.play).toHaveBeenCalled();
    await act(async () => {
      mockEcouteurs.playingChange({ isPlaying: true });
      mockEcouteurs.playingChange({ isPlaying: false });
      mockEcouteurs.playingChange({ isPlaying: true });
    });
    expect((suivre as jest.Mock).mock.calls.filter((c: unknown[]) => c[0] === 'cert_video_started')).toHaveLength(1);
    await act(async () => {
      mockEcouteurs.playToEnd();
    });
    expect(suivre).toHaveBeenCalledWith('cert_video_completed', { notion: 'prepo' });
  });

  it('maquette v3 : barre de contrôle sous l’image, lecture et pause, progression, temps et plein écran', async () => {
    (chargerVideoNotion as jest.Mock).mockResolvedValue(VIDEO);
    await monter(<FicheNotion />);
    // Avant la lecture : bouton de la barre, temps 0:00 / 2:20 (durée du fichier meta), plein écran et piste présents.
    expect(await screen.findByText('0:00 / 2:20')).toBeTruthy();
    expect(screen.getByRole('button', { name: t.fiche.video.pleinEcran })).toBeTruthy();
    expect(screen.getByTestId('video-notion-piste')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Lancer la vidéo/ }));
    // Pendant la lecture : le bouton devient « Pause » et le temps avance.
    await act(async () => {
      mockLecteur.playing = true;
      mockEcouteurs.playingChange({ isPlaying: true });
      mockEcouteurs.timeUpdate({ currentTime: 42 });
    });
    expect(screen.getByText('0:42 / 2:20')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t.fiche.video.pause }));
    expect(mockLecteur.pause).toHaveBeenCalled();
    await act(async () => {
      mockLecteur.playing = false;
      mockEcouteurs.playingChange({ isPlaying: false });
    });
    expect(screen.getByRole('button', { name: t.fiche.video.lecture })).toBeTruthy();
    // La piste se touche : action d’accessibilité « avancer de 5 secondes ».
    const piste = screen.getByTestId('video-notion-piste');
    await act(async () => {
      piste.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
    });
    expect(mockLecteur.currentTime).toBe(47);
  });

  it('maquette 4 : notion sans vidéo, la fiche reste dépliée, sans bloc vide ni « Lire la fiche »', async () => {
    (chargerVideoNotion as jest.Mock).mockResolvedValue(null);
    await monter(<FicheNotion />);
    expect(await screen.findByText(t.fiche.regle)).toBeTruthy();
    expect(screen.queryByText(t.fiche.video.etiquette)).toBeNull();
    expect(screen.queryByText(t.fiche.video.lireFiche)).toBeNull();
  });

  it('la vidéo se met en pause et se libère en quittant l’écran', async () => {
    (chargerVideoNotion as jest.Mock).mockResolvedValue(VIDEO);
    const { unmount } = await monter(<FicheNotion />);
    await fireEvent.press(await screen.findByRole('button', { name: /^Lancer la vidéo/ }));
    await waitFor(() => expect(mockLecteur.play).toHaveBeenCalled());
    await act(async () => unmount());
    expect(mockLecteur.pause).toHaveBeenCalled();
    expect(mockLecteur.release).toHaveBeenCalled();
  });
});
