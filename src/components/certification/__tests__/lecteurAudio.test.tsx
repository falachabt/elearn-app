import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import { fr } from '@/i18n/fr';

import { LecteurAudio } from '../LecteurAudio';
import { monter } from './harnais';

const t = fr.certification;

type Ecoute = (statut: Record<string, unknown>) => void;
const mockEcoutes: Ecoute[] = [];

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn(() => ({
    addListener: (_nom: string, cb: (s: Record<string, unknown>) => void) => {
      mockEcoutes.push(cb);
    },
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    remove: jest.fn(),
  })),
}));

const rendre = (delaiEchecS = 3) =>
  monter(<LecteurAudio uri="https://exemple.test/toeic/audio/p1_1.mp3" libelle="Question 1" unique delaiEchecS={delaiEchecS} ecran="diagnostic" onPasser={() => {}} />);

/** Évènement natif : fichier chargé, lecture en cours, position donnée. */
const statut = (currentTime: number) => {
  act(() => {
    mockEcoutes.forEach((cb) => cb({ isLoaded: true, playing: true, currentTime, duration: 12, didJustFinish: false }));
  });
};

describe('LecteurAudio : garde-fou contre un audio figé', () => {
  beforeEach(() => {
    mockEcoutes.length = 0;
  });

  it('règle le mode audio pour une épreuve écoutée, même en silencieux', async () => {
    await rendre();
    fireEvent.press(screen.getByLabelText(t.exercice.ecouter));
    expect(setAudioModeAsync).toHaveBeenCalledWith(expect.objectContaining({ playsInSilentMode: true }));
  });

  it('crée le lecteur avec un suivi de position fréquent', async () => {
    await rendre();
    fireEvent.press(screen.getByLabelText(t.exercice.ecouter));
    expect(createAudioPlayer).toHaveBeenCalledWith({ uri: 'https://exemple.test/toeic/audio/p1_1.mp3' }, { updateInterval: 250 });
  });

  it('chargé mais figé à 0:00 : passe en « audio indisponible » après le délai', async () => {
    await rendre(1);
    fireEvent.press(screen.getByLabelText(t.exercice.ecouter));
    statut(0);
    await waitFor(() => expect(screen.getByText(t.exercice.audioKoTitre)).toBeTruthy(), { timeout: 3000 });
  });

  it("la lecture qui progresse ne déclenche jamais l'erreur", async () => {
    await rendre(1);
    fireEvent.press(screen.getByLabelText(t.exercice.ecouter));
    statut(0.5);
    statut(1);
    await act(() => new Promise((r) => setTimeout(r, 1500)));
    expect(screen.queryByText(t.exercice.audioKoTitre)).toBeNull();
  });
});
