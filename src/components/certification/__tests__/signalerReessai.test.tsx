import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';

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

describe('X2 · Signaler une erreur, nouvel essai', () => {
  it('un échec garde le même identifiant au nouvel essai (idempotent côté serveur)', async () => {
    mockParams = { question: 'q9', partie: '1' };
    const uuids: string[] = [];
    let echecs = 1;
    definirApi({
      ...fausse.api,
      signalerErreur: async (_q, _t, uuid) => {
        uuids.push(uuid);
        if (echecs-- > 0) throw new Error('serveur');
      },
    });
    await monter(<SignalerErreur />);
    await act(async () => {});
    fireEvent.press(screen.getByRole('radio', { name: new RegExp(t.motif_audio) }));
    await act(async () => {});
    fireEvent.press(screen.getByRole('button', { name: t.envoyer }));
    await waitFor(() => expect(screen.getByText(t.erreurTitre)).toBeTruthy());
    await act(async () => {});
    fireEvent.press(screen.getByRole('button', { name: t.envoyer }));
    await waitFor(() => expect(uuids).toEqual(['uuid-1', 'uuid-1']));
    await waitFor(() => expect(suivre).toHaveBeenCalledWith('cert_error_reported', { type: 'audio' }));
  });
});
