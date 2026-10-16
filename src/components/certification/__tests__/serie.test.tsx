import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import { lireSerieEnCours } from '@/services/certification/serie';
import { enregistrerProfil } from '@/services/profil';

import { FinSerie } from '../FinSerie';
import { Serie } from '../Serie';
import { attendre, monter } from './harnais';

const t = fr.certification;

let mockPass = false;
let mockSolde = 12;
let mockCout = 1;
const mockDepenser = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({ part: '5' }),
}));
jest.mock('@/services/analytics', () => ({
  suivre: jest.fn(),
  drapeauActif: jest.fn(() => true),
  ecouterDrapeaux: jest.fn(() => () => {}),
}));
let mockCompteur = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockCompteur}` }));
jest.mock('@/session/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'u1', is_anonymous: false } } }) }));
jest.mock('@/session/CreditsProvider', () => ({
  useCredits: () => ({
    solde: { illimite: mockPass, total: mockSolde, semaine: 0, recompenses: 0, recharge: 25, rechargeHebdo: true, prochaineRecharge: new Date(Date.now() + 86400000).toISOString(), illimiteJusqua: null, expirationRecompenses: null },
    reglages: { bienvenue: 40, invite: 5, recharge: 25 },
    couts: { cert_explanation: mockCout },
    depenser: (...a: unknown[]) => mockDepenser(...a),
    rafraichir: async () => {},
  }),
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const { forwardRef } = jest.requireActual<typeof import('react')>('react');
  const passe = forwardRef(function Feuille({ children }: { children?: React.ReactNode }, _ref: unknown) {
    return children ?? null;
  });
  return {
    __esModule: true,
    default: passe,
    BottomSheetView: ({ children }: { children?: React.ReactNode }) => children ?? null,
    BottomSheetModal: passe,
    BottomSheetModalProvider: ({ children }: { children?: React.ReactNode }) => children ?? null,
    BottomSheetBackdrop: () => null,
    BottomSheetFlatList: () => null,
    BottomSheetTextInput: () => null,
  };
});

let fausse: ReturnType<typeof creerApiFausse>;
const installer = (options: Parameters<typeof creerApiFausse>[0] = {}) => {
  fausse = creerApiFausse(options);
  definirApi(fausse.api);
};

beforeEach(async () => {
  jest.clearAllMocks();
  mockCompteur = 0;
  mockPass = false;
  mockSolde = 12;
  mockCout = 1;
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: false });
  installer();
});
afterEach(() => definirApi(null));

const repondre = async (lettre: string) => {
  await fireEvent.press(await screen.findByText(new RegExp(`^${lettre}\\b`)));
  await fireEvent.press(screen.getByText(fr.certification.diagnostic.valider));
};

describe('B8 à B9 · Série', () => {
  it('charge la série de la partie demandée et propose le choix', async () => {
    await monter(<Serie />);
    expect(await screen.findByText(/Question \d+/)).toBeTruthy();
    expect(fausse.appels.series).toEqual([{ part: 5, notion: undefined }]);
  });

  it('bonne réponse : explication B9 avec badge, piège et mot clé ajoutable', async () => {
    await monter(<Serie />);
    await repondre('A');
    expect(await screen.findByText(t.explication.badge)).toBeTruthy();
    expect(screen.getByText(/Piège de la forme du mot/)).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('cert_exercise_answered', expect.objectContaining({ juste: true }));
    await fireEvent.press(screen.getByText(/^\+ word/));
    await waitFor(() => expect(fausse.appels.mots.length).toBe(1));
  });

  it('mauvaise réponse : indique la réponse de l’élève', async () => {
    await monter(<Serie />);
    await repondre('B');
    await screen.findByText(t.explication.badge);
    expect(screen.getByText(t.explication.tienne.replace('{{lettre}}', 'B'))).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('cert_exercise_answered', expect.objectContaining({ juste: false }));
  });

  it('hors Pass avec un coût : le détail passe par la feuille X1, puis la dépense', async () => {
    mockDepenser.mockResolvedValue({ statut: 'spent', cout: 1, solde: 11, contenu: { explanation: 'Parce que a.', trap: null } });
    await monter(<Serie />);
    await repondre('A');
    await fireEvent.press(await screen.findByText(t.explication.detail, { exact: false }));
    expect(await screen.findByText(t.explication.plusTard)).toBeTruthy();
    await fireEvent.press(screen.getByText(t.explication.voir));
    await waitFor(() => expect(mockDepenser).toHaveBeenCalledWith('cert_explanation', expect.any(String)));
    expect(await screen.findByText('Parce que a.', { exact: false })).toBeTruthy();
  });

  it('avec le Pass : pas de feuille, l’explication s’ouvre directement', async () => {
    mockPass = true;
    mockDepenser.mockResolvedValue({ statut: 'unlimited', cout: 0, solde: 0, contenu: { explanation: 'Détail Pass.', trap: null } });
    await monter(<Serie />);
    await repondre('A');
    await fireEvent.press(await screen.findByText(t.explication.detail, { exact: false }));
    expect(await screen.findByText('Détail Pass.', { exact: false })).toBeTruthy();
    expect(screen.queryByText(t.explication.voir)).toBeNull();
  });

  it('envoi impossible : bloc « non envoyée », la série continue', async () => {
    installer({ echecsEnvoi: 5 });
    await monter(<Serie />);
    await repondre('A');
    expect(await screen.findByText(t.serie.nonEnvoyeeTitre)).toBeTruthy();
    expect(screen.getByText(t.serie.reessayerMaintenant)).toBeTruthy();
    const etat = await lireSerieEnCours();
    expect(etat?.enAttente.length).toBe(1);
  });

  it('série impossible à charger : message d’erreur', async () => {
    installer({ echecSerie: true });
    await monter(<Serie />);
    expect(await screen.findByText(t.serie.erreurTitre)).toBeTruthy();
  });

  it('thème sombre : l’explication s’affiche aussi', async () => {
    await monter(<Serie />, 'sombre');
    await repondre('A');
    expect(await screen.findByText(t.explication.badge)).toBeTruthy();
  });
});

describe('B11 · Fin de série', () => {
  it('va au bout de la série puis affiche le score et le rejeu', async () => {
    await monter(<Serie />);
    for (let i = 0; i < 3; i++) {
      await repondre(i === 0 ? 'B' : 'A');
      await screen.findByText(t.explication.badge);
      const derniere = i === 2;
      await fireEvent.press(screen.getByText(derniere ? t.serie.terminer : t.serie.suivante));
      if (!derniere) await screen.findByText(/Question \d+/);
    }
    expect(router.replace).toHaveBeenCalledWith('/certification/serie-fin');
    await monter(<FinSerie />);
    expect(await screen.findByText(t.finSerie.entete)).toBeTruthy();
    expect(await screen.findByText('2 / 3')).toBeTruthy();
    expect(screen.getByText(t.finSerie.rateeUne)).toBeTruthy();
    expect(screen.getByText(t.finSerie.notions)).toBeTruthy();
    await attendre();
  });

  it('sans série terminée : retour à la série', async () => {
    await monter(<FinSerie />);
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
  });
});
