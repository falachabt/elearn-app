import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import { motifsPour, TYPE_DU_MOTIF } from '@/services/certification/signalement';

import { SignalerErreur } from '../SignalerErreur';
import { monter } from './harnais';

let mockParams: Record<string, string> = {};
let mockCompteur = 0;
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockCompteur}` }));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), definirProprietesUtilisateur: jest.fn(), drapeauActif: jest.fn(() => true), ecouterDrapeaux: jest.fn(() => () => {}) }));

const t = fr.certification.signaler;
let fausse: ReturnType<typeof creerApiFausse>;

beforeEach(() => {
  mockCompteur = 0;
  (suivre as jest.Mock).mockClear();
  fausse = creerApiFausse();
  definirApi(fausse.api);
});
afterAll(() => definirApi(null));

describe('signalement : motifs et types serveur', () => {
  it('propose le son seulement pour les parties d’écoute', () => {
    expect(motifsPour(2)).toEqual(['reponse', 'explication', 'audio']);
    expect(motifsPour(5)).toEqual(['reponse', 'explication']);
  });
  it('envoie un type admis par la table (reponse, audio, autre)', () => {
    expect(Object.values(TYPE_DU_MOTIF).every((v) => ['reponse', 'enonce', 'audio', 'autre'].includes(v))).toBe(true);
  });
});

describe('X2 · Signaler une erreur', () => {
  it('affiche les textes de la maquette, numéro et notion compris', async () => {
    mockParams = { question: 'q1', partie: '2', numero: '112', notion: 'Prépositions' };
    await monter(<SignalerErreur />);
    expect(screen.getByText(t.intro)).toBeTruthy();
    expect(screen.getByText(t.motif_reponse)).toBeTruthy();
    expect(screen.getByText('Question 112')).toBeTruthy();
    expect(screen.getByText('Notion : Prépositions')).toBeTruthy();
    expect(screen.getByText(t.motif_audio)).toBeTruthy();
    expect(screen.getByText(t.confidentialite)).toBeTruthy();
  });

  it('pas de motif « son » en lecture', async () => {
    mockParams = { question: 'q1', partie: '6' };
    await monter(<SignalerErreur />, 'sombre');
    expect(screen.queryByText(t.motif_audio)).toBeNull();
  });

  it('« Envoyer » ne part pas tant qu’aucun motif n’est choisi', async () => {
    mockParams = { question: 'q1', partie: '5' };
    await monter(<SignalerErreur />);
    await act(async () => {});
    fireEvent.press(screen.getByRole('button', { name: t.envoyer }));
    expect(fausse.appels.signalements).toHaveLength(0);
  });

  it('envoie la question et le type, suit l’évènement, puis remercie', async () => {
    mockParams = { question: 'q9', partie: '3', numero: '45' };
    await monter(<SignalerErreur />);
    fireEvent.press(screen.getByRole('radio', { name: new RegExp(t.motif_explication) }));
    await act(async () => {});
    fireEvent.press(screen.getByRole('button', { name: t.envoyer }));
    await waitFor(() => expect(screen.getByText(t.merciTitre)).toBeTruthy());
    expect(fausse.appels.signalements).toEqual([{ question: 'q9', type: 'autre', uuid: 'uuid-1' }]);
    expect(suivre).toHaveBeenCalledWith('cert_error_reported', { type: 'autre' });
  });

});
