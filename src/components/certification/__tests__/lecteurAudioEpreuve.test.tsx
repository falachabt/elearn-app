import { act, fireEvent, screen } from '@testing-library/react-native';

import { fr } from '@/i18n/fr';

import { LecteurAudio } from '../LecteurAudio';
import { monter } from './harnais';

const t = fr.certification;

const ecoutes: ((statut: Record<string, unknown>) => void)[] = [];

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn(() => ({
    addListener: (_nom: string, cb: (s: Record<string, unknown>) => void) => {
      ecoutes.push(cb);
    },
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    remove: jest.fn(),
  })),
}));

describe("LecteurAudio : écoute unique pendant l'épreuve (Examen)", () => {
  beforeEach(() => {
    ecoutes.length = 0;
  });

  it("affiche « pas de réécoute pendant l'épreuve » une fois la piste jouée, sans bouton de relance", async () => {
    await monter(<LecteurAudio uri="https://exemple.test/toeic/audio/p1_1.mp3" libelle="Question 1" unique delaiEchecS={3} ecran="mini_test" onPasser={() => {}} />);
    fireEvent.press(screen.getByLabelText(t.exercice.ecouter));
    await act(async () => {
      ecoutes.forEach((cb) => cb({ isLoaded: true, playing: false, currentTime: 12, duration: 12, didJustFinish: true }));
    });
    expect(screen.getByText(t.exercice.ecouteExamen)).toBeTruthy();
    expect(screen.queryByLabelText(t.exercice.reecouter)).toBeNull();
    expect(screen.getByLabelText(t.exercice.ecouter).props.accessibilityState?.disabled).toBe(true);
  });
});
