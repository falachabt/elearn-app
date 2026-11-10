import { fireEvent, screen } from '@testing-library/react-native';
import { createAudioPlayer } from 'expo-audio';

import { fr } from '@/i18n/fr';

import { LecteurAudio } from '../LecteurAudio';
import { monter } from './harnais';

const t = fr.certification;

const pistes: { pause: jest.Mock; remove: jest.Mock; play: jest.Mock }[] = [];

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn(() => {
    const piste = { addListener: jest.fn(), play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(() => Promise.resolve()), remove: jest.fn() };
    pistes.push(piste);
    return piste;
  }),
}));

const lecteur = (uri: string) => <LecteurAudio uri={uri} libelle="Question" delaiEchecS={3} ecran="mini_test" onPasser={() => {}} />;

describe('LecteurAudio : pas de fuite entre questions', () => {
  beforeEach(() => {
    pistes.length = 0;
    jest.mocked(createAudioPlayer).mockClear();
  });

  it('enchaîne 30 questions audio : chaque question arrête le son de la précédente, un seul son actif', async () => {
    const { rerender } = await monter(lecteur('https://exemple.test/piste-0.mp3'));
    for (let i = 0; i < 30; i++) {
      rerender(<LecteurAudio uri={`https://exemple.test/piste-${i}.mp3`} libelle="Question" delaiEchecS={3} ecran="mini_test" onPasser={() => {}} />);
      fireEvent.press(screen.getByLabelText(t.exercice.ecouter));
    }
    expect(pistes).toHaveLength(30);
    // Toutes les pistes sauf la dernière sont arrêtées et libérées.
    pistes.slice(0, -1).forEach((p) => {
      expect(p.pause).toHaveBeenCalled();
      expect(p.remove).toHaveBeenCalled();
    });
    // La dernière reste la seule active.
    expect(pistes[pistes.length - 1]!.remove).not.toHaveBeenCalled();
  });
});
