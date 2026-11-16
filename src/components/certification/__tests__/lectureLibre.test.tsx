import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { fr } from '@/i18n/fr';
import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import { LIGNES_SEED } from '@/services/certification/__tests__/fixtures';
import { ecrireMini, lancerMini, lireMini, type EtatMini } from '@/services/certification/miniTest';
import { lireReglages } from '@/services/certification/reglages';
import { enregistrerProfil } from '@/services/profil';

import { MiniTest } from '../MiniTest';
import { monter } from './harnais';

const l = fr.certification.examen.libre;

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => cb(), [cb]);
  },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), definirProprietesUtilisateur: jest.fn(), drapeauActif: jest.fn(() => true), ecouterDrapeaux: jest.fn(() => () => {}) }));
let mockCompteur = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockCompteur}` }));
jest.mock('expo-audio', () => ({ createAudioPlayer: jest.fn() }));
jest.mock('@/session/CreditsProvider', () => ({
  useCredits: () => ({
    solde: { illimite: false, total: 12, semaine: 0, recompenses: 0, recharge: 25, rechargeHebdo: true, prochaineRecharge: '2026-10-19T00:00:00Z', illimiteJusqua: null, expirationRecompenses: null },
    reglages: { bienvenue: 40, invite: 5, recharge: 25 },
    couts: {},
    depenser: jest.fn(),
    rafraichir: jest.fn(),
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

/** Une moitié lecture déjà lancée : la Lecture se parcourt librement. */
async function semer(): Promise<EtatMini> {
  const lance = await lancerMini('toeic', 5, 10, lireReglages(LIGNES_SEED));
  if (lance.statut !== 'demarre') throw new Error('départ attendu');
  const etat = { ...lance.etat, tentative: { ...lance.etat.tentative, kind: 'half_reading' as const } };
  await ecrireMini(etat);
  return etat;
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockCompteur = 0;
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: true });
  definirApi(creerApiFausse().api);
});
afterEach(() => definirApi(null));

describe('lecture en navigation libre', () => {
  it('la grille ramène à une question déjà vue et la réponse se corrige', async () => {
    await semer();
    await monter(<MiniTest />);
    await fireEvent.press(await screen.findByText(/^A\b/));
    await fireEvent.press(screen.getByLabelText(l.grille_sans.replace('{{n}}', '11')));
    await fireEvent.press(await screen.findByLabelText(l.grille_repondue.replace('{{n}}', '10')));
    await fireEvent.press(await screen.findByText(/^B\b/));
    await waitFor(async () => {
      const e = await lireMini();
      expect(e?.reponses).toHaveLength(1);
      expect(e?.reponses[0]?.chosen).toBe(1);
    });
  });

  it('« Terminer le test » annonce les questions sans réponse puis ouvre le bilan', async () => {
    const e = await semer();
    await monter(<MiniTest />);
    await fireEvent.press(await screen.findByText(/^A\b/));
    await fireEvent.press(screen.getByText(l.suivante));
    await fireEvent.press(await screen.findByText(l.suivante));
    await fireEvent.press(await screen.findByText(l.terminer));
    const reste = e.tentative.questions.length - 1;
    expect(await screen.findByText(l.terminerTitre)).toBeTruthy();
    expect(screen.getByText(new RegExp(`^${reste} questions`))).toBeTruthy();
    await fireEvent.press(screen.getAllByText(l.terminerConfirmer)[0]);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/certification/mini-bilan'));
    const fin = await lireMini();
    expect(fin?.termine).toBe(true);
    expect(fin?.reponses).toHaveLength(1);
  });
});
