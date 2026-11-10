import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { createAudioPlayer } from 'expo-audio';

import { fr } from '@/i18n/fr';

import { LecteurAudio } from '../LecteurAudio';
import { monter } from './harnais';

const t = fr.certification;

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn(() => ({
    addListener: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    remove: jest.fn(),
  })),
}));

const uri = 'https://example.test/toeic/t2/audio/t2_p2_30.mp3';

describe('LecteurAudio : relance avant « audio indisponible »', () => {
  beforeEach(() => {
    jest.mocked(createAudioPlayer).mockClear();
  });

  it('un lecteur figé à 0:00 est relancé une fois, puis passe en erreur', async () => {
    await monter(<LecteurAudio uri={uri} libelle="Question 30" delaiEchecS={1} ecran="serie" onPasser={() => {}} />);
    fireEvent.press(screen.getByLabelText(t.exercice.ecouter));
    expect(createAudioPlayer).toHaveBeenCalledTimes(1);

    // Première échéance : nouvelle lecture, sans message d'erreur.
    await waitFor(() => expect(createAudioPlayer).toHaveBeenCalledTimes(2), { timeout: 3000 });
    expect(screen.queryByText(t.exercice.audioKoTitre)).toBeNull();

    // Deuxième échéance : « audio indisponible », avec le bouton pour réessayer.
    await waitFor(() => expect(screen.getByText(t.exercice.audioKoTitre)).toBeTruthy(), { timeout: 3000 });
    expect(screen.getByText(t.exercice.audioKoReessayer)).toBeTruthy();
  }, 15000);
});
