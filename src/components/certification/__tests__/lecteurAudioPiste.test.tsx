import { screen } from '@testing-library/react-native';
import { createAudioPlayer } from 'expo-audio';

import { fr } from '@/i18n/fr';
import { etatInitial, reduireLecteur } from '@/services/certification/lecteur';

import { LecteurAudio } from '../LecteurAudio';
import { monter } from './harnais';

const t = fr.certification;

type Ecoute = (statut: Record<string, unknown>) => void;
const ecoutes: { cb: Ecoute; remove: jest.Mock }[] = [];


jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn(() => {
    const remove = jest.fn();
    return {
      addListener: (_nom: string, cb: Ecoute) => {
        ecoutes.push({ cb, remove });
      },
      play: jest.fn(),
      pause: jest.fn(),
      seekTo: jest.fn(() => Promise.resolve()),
      remove,
    };
  }),
}));

const lecteur = (uri: string | null) => <LecteurAudio uri={uri} libelle="Question 1" delaiEchecS={3} ecran="serie" onPasser={() => {}} />;

describe('LecteurAudio : une piste par question', () => {
  beforeEach(() => {
    ecoutes.length = 0;
    jest.mocked(createAudioPlayer).mockClear();
  });

  it('sans piste (question sans audio) : « audio indisponible » tout de suite, rien à lancer', async () => {
    await monter(lecteur(null));
    expect(screen.getByText(t.exercice.audioKoTitre)).toBeTruthy();
    expect(screen.queryByLabelText(t.exercice.ecouter)).toBeNull();
    expect(createAudioPlayer).not.toHaveBeenCalled();
  });
});

describe('lecteur audio : nouvelle piste repart de zéro', () => {
  it('l’évènement « réinitialiser » efface la lecture de la question précédente', () => {
    let e = reduireLecteur(etatInitial, { type: 'jouer' }, false);
    e = reduireLecteur(e, { type: 'statut', chargee: true, enLecture: true, position: 7, duree: 12, termine: false }, false);
    expect(e).toMatchObject({ phase: 'lecture', position: 7 });
    expect(reduireLecteur(e, { type: 'reinitialiser' }, false)).toEqual(etatInitial);
  });

  it('après « réinitialiser », l’écoute unique est de nouveau disponible', () => {
    let e = reduireLecteur(etatInitial, { type: 'jouer' }, true);
    e = reduireLecteur(e, { type: 'statut', chargee: true, enLecture: false, position: 12, duree: 12, termine: true }, true);
    expect(e.jouee).toBe(true);
    expect(reduireLecteur(e, { type: 'reinitialiser' }, true).jouee).toBe(false);
  });
});
