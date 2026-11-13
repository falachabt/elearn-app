import { act, fireEvent, screen } from '@testing-library/react-native';

import { fr } from '@/i18n/fr';
import { definirConnectivitePourTest, forcerConnexion } from '@/services/connectivite';

import { LecteurAudio } from '../LecteurAudio';
import { monter } from './harnais';

const t = fr.certification.exercice;

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn(() => ({ addListener: jest.fn(), play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(() => Promise.resolve()), remove: jest.fn() })),
}));

afterEach(() => forcerConnexion(null));

describe('X4 · Pack audio manquant (hors ligne)', () => {
  it('hors ligne, sans audio : les textes de la maquette et « Continuer sans audio » passe la question', async () => {
    forcerConnexion(false);
    definirConnectivitePourTest({ connecte: false });
    const passer = jest.fn();
    await monter(<LecteurAudio uri={null} libelle="Question 12" delaiEchecS={1} ecran="serie" onPasser={passer} />, 'sombre');
    await act(async () => {});
    expect(screen.getByText(t.packTitre)).toBeTruthy();
    expect(screen.getByText(t.packHorsLigne)).toBeTruthy();
    expect(screen.getByText(t.packManque)).toBeTruthy();
    expect(screen.getByText(t.packTexte)).toBeTruthy();
    expect(screen.getByText('Contenu périmé après 7 jours sans connexion : il se remet à jour dès que tu es en ligne.')).toBeTruthy();
    expect(screen.queryByText(t.audioKoTitre)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: t.packSansAudio }));
    expect(passer).toHaveBeenCalledTimes(1);
  });

  it('en ligne, sans audio : l’état B8 « Audio indisponible » reste celui affiché', async () => {
    forcerConnexion(true);
    await monter(<LecteurAudio uri={null} libelle="Question 12" delaiEchecS={1} ecran="serie" onPasser={() => {}} />);
    await act(async () => {});
    expect(screen.getByText(t.audioKoTitre)).toBeTruthy();
    expect(screen.queryByText(t.packTitre)).toBeNull();
  });
});
