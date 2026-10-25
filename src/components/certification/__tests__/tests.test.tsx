import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Text } from 'react-native';

import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import { LIGNES_SEED } from '@/services/certification/__tests__/fixtures';
import { JOUR } from '@/services/certification/__tests__/fixturesRevision';
import { ecrireMini, lancerMini, lireMini, repondreMini, type EtatMini } from '@/services/certification/miniTest';
import { lireReglages } from '@/services/certification/reglages';
import type { TentativeListee } from '@/services/certification/types';
import { enregistrerProfil } from '@/services/profil';
import { ForcerSombre, useTheme } from '@/theme/ThemeProvider';

import { BilanMini } from '../BilanMini';
import { MiniRevue } from '../MiniRevue';
import { DetailTentative } from '../DetailTentative';
import { HistoriqueTests } from '../HistoriqueTests';
import { MiniTest } from '../MiniTest';
import { ReglageMini } from '../ReglageMini';
import { TestBientot } from '../TestBientot';
import { TestsToeic } from '../TestsToeic';
import { monter } from './harnais';

const t = fr.certification;
const reglages = lireReglages(LIGNES_SEED);

let mockParams: Record<string, string> = {};
let mockPass = false;
let mockSolde = 12;
let mockCouts: Record<string, number> = { cert_mock_mini_ten: 1, cert_mock_mini_twenty: 2 };
const mockRafraichir = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => cb(), [cb]);
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), definirProprietesUtilisateur: jest.fn(), drapeauActif: jest.fn(() => true), ecouterDrapeaux: jest.fn(() => () => {}) }));
let mockCompteur = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockCompteur}` }));
jest.mock('expo-audio', () => ({ createAudioPlayer: jest.fn() }));
jest.mock('@/session/CreditsProvider', () => ({
  useCredits: () => ({
    solde: { illimite: mockPass, total: mockSolde, semaine: 0, recompenses: 0, recharge: 25, rechargeHebdo: true, prochaineRecharge: '2026-10-19T00:00:00Z', illimiteJusqua: null, expirationRecompenses: null },
    reglages: { bienvenue: 40, invite: 5, recharge: 25 },
    couts: mockCouts,
    depenser: jest.fn(),
    rafraichir: (...a: unknown[]) => mockRafraichir(...a),
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
const HORS_LIGNE = { doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'clearTimeout', 'clearInterval', 'nextTick', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame'] as ('setTimeout' | 'setInterval' | 'setImmediate' | 'clearTimeout' | 'clearInterval' | 'nextTick' | 'queueMicrotask' | 'requestAnimationFrame' | 'cancelAnimationFrame')[] };

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(`${JOUR}T10:00:00`), ...HORS_LIGNE });
  jest.clearAllMocks();
  mockCompteur = 0;
  mockParams = {};
  mockPass = false;
  mockSolde = 12;
  mockCouts = { cert_mock_mini_ten: 1, cert_mock_mini_twenty: 2 };
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: true });
  installer();
});
afterEach(() => {
  definirApi(null);
  jest.useRealTimers();
});

/** Un test déjà lancé, comme si l'élève était parti en cours de route. */
async function semer(options: { partie?: number | null; longueur?: 10 | 20; reponses?: number; decalageMs?: number } = {}): Promise<EtatMini> {
  const lance = await lancerMini('toeic', options.partie === undefined ? 5 : options.partie, options.longueur ?? 10, reglages);
  if (lance.statut !== 'demarre') throw new Error('départ attendu');
  let etat = lance.etat;
  for (let i = 0; i < (options.reponses ?? 0); i++) etat = await repondreMini(etat, 0, 100);
  if (options.decalageMs) {
    etat = { ...etat, debutMs: etat.debutMs - options.decalageMs };
    await ecrireMini(etat);
  }
  return etat;
}

const LIGNE = (surcharge: Partial<TentativeListee>): TentativeListee => ({
  id: 'h1', kind: 'mini', part: 5, length: 10, status: 'finished', scoreMin: null, scoreMax: null, startedAt: '2026-10-12T10:00:00Z', finishedAt: '2026-10-12T10:08:00Z',
  perPart: { '5': { answered: 10, correct: 8 } }, timePerPart: null, creditsSpent: 1, refunded: false, questions: [], ...surcharge,
});

describe('T1 · onglet Tests', () => {
  it('affiche les mini-tests avec les coûts du serveur, le score estimé et les tests faits', async () => {
    installer({ tentatives: [LIGNE({ id: 'a', kind: 'mini', part: null, scoreMin: 650, scoreMax: 730 }), LIGNE({ id: 'b' }), LIGNE({ id: 'c', status: 'abandoned' }), LIGNE({ id: 'd', kind: 'diagnostic' })] });
    await monter(<TestsToeic />);
    // Le statut du mini-test précède son détail (maquette v33) : 8 bonnes réponses sur 10, pour la partie 5 comme pour le mixte.
    // La carte des minis par partie annonce les longueurs servies selon les parties (réglage du seed) : 10 ou 12.
    expect(await screen.findByText(`${t.tests.detailMiniPartiePlage.replace('{{min}}', '10').replace('{{max}}', '12')} · ${fr.credits.coutUn} hors Pass`)).toBeTruthy();
    expect(screen.getAllByText(t.tests.statut.fait).length).toBeGreaterThan(0);
    expect(screen.getAllByText('8 sur 10').length).toBeGreaterThan(0);
    expect(screen.getByText(`${t.tests.detailMiniMixte} · ${fr.credits.cout.replace('{{n}}', '2')} hors Pass`)).toBeTruthy();
    expect(screen.getByText('650 à 730 sur 990')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('cert_tests_tab_viewed', {});
  });

  it('avec le Pass : plus de coût sur les lignes, tout est inclus', async () => {
    mockPass = true;
    await monter(<TestsToeic />);
    expect(await screen.findByText(t.tests.inclus)).toBeTruthy();
    expect(screen.getAllByText(t.tests.statut.pasFait).length).toBeGreaterThan(0);
    expect(screen.getByText(t.tests.detailMiniPartiePlage.replace('{{min}}', '10').replace('{{max}}', '12'))).toBeTruthy();
  });

  it('les demi-tests et le test complet mènent à leur liste de tests', async () => {
    await monter(<TestsToeic />);
    await fireEvent.press(await screen.findByText(t.tests.complet));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/liste-tests', params: { kind: 'full' } });
    await fireEvent.press(await screen.findByText(t.tests.demiEcoute));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/liste-tests', params: { kind: 'listening' } });
    await fireEvent.press(await screen.findByText(t.tests.demiLecture));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/liste-tests', params: { kind: 'reading' } });
  });

  it('historique injoignable : l’écran reste utilisable, les tests faits sont inconnus', async () => {
    installer({ tentatives: 'echec' });
    await monter(<TestsToeic />);
    expect(await screen.findByText(t.tests.choisir)).toBeTruthy();
    expect(screen.getByText('–')).toBeTruthy();
    await fireEvent.press(screen.getByText(t.tests.choisir));
    expect(router.push).toHaveBeenCalledWith('/certification/mini');
  });

  it('thème sombre : mêmes écrans', async () => {
    await monter(<TestsToeic />, 'sombre');
    expect(await screen.findByText(t.tests.choisir)).toBeTruthy();
  });
});

describe('T3 · reprise d’un test interrompu', () => {
  it('montre l’avancement et le temps restant, et reprend le même test', async () => {
    // La fausse banque sert 3 questions de partie 5 : la session dure 3 minutes (durée au servi), 1 min 50 écoulées.
    await semer({ reponses: 2, decalageMs: 1 * 60_000 + 50_000 });
    await monter(<TestsToeic />);
    expect(await screen.findByText(t.tests.reprise.titre)).toBeTruthy();
    expect(screen.getByText('1 min 10')).toBeTruthy();
    expect(screen.getByText(t.tests.reprise.sousMini.replace('{{n}}', '5'))).toBeTruthy();
    expect(screen.getAllByText(t.tests.reprise.avancement.replace('{{faites}}', '2').replace('{{total}}', '3')).length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByText(t.tests.reprise.reprendre));
    expect(router.push).toHaveBeenCalledWith('/certification/mini-test');
    expect(suivre).toHaveBeenCalledWith('cert_mock_resumed', { kind: 'mini', minute: 1 });
  });

  it('abandon dans la fenêtre : confirmation, appel au serveur, état effacé, crédits rendus annoncés', async () => {
    installer({ abandon: { rembourse: true } });
    await semer({ reponses: 1 });
    await monter(<TestsToeic />);
    await fireEvent.press(await screen.findByText(t.tests.reprise.abandonner));
    expect(await screen.findByText(t.tests.reprise.confirmeRendu.replace('{{min}}', String(reglages.fenetreRemboursementMin)))).toBeTruthy();
    await fireEvent.press(screen.getByText(t.tests.reprise.confirmer));
    await waitFor(() => expect(fausse.appels.abandons).toHaveLength(1));
    expect(fausse.appels.abandons[0].raison).toBe('user');
    await waitFor(async () => expect(await lireMini()).toBeNull());
    expect(await screen.findByText(t.tests.abandonneRendu)).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('cert_mock_abandoned', { kind: 'mini', minute: 0 });
  });

  it('abandon hors de la fenêtre : le texte dit que les crédits ne sont pas rendus', async () => {
    await semer({ decalageMs: (reglages.fenetreRemboursementMin + 1) * 60_000 - 1000 });
    await monter(<TestsToeic />);
    await fireEvent.press(await screen.findByText(t.tests.reprise.abandonner));
    expect(await screen.findByText(t.tests.reprise.confirmeNonRendu.replace('{{min}}', String(reglages.fenetreRemboursementMin)))).toBeTruthy();
  });

  it('abandon impossible sans réseau : le test reste à reprendre', async () => {
    await semer();
    fausse.api.abandonnerTentative = async () => {
      throw new Error('réseau');
    };
    await monter(<TestsToeic />);
    await fireEvent.press(await screen.findByText(t.tests.reprise.abandonner));
    await fireEvent.press(screen.getByText(t.tests.reprise.confirmer));
    await waitFor(() => expect(screen.getByText(t.tests.reprise.titre)).toBeTruthy());
    expect(await lireMini()).not.toBeNull();
  });

  it('temps écoulé dans la tolérance : propose le bilan avec les réponses données', async () => {
    await semer({ reponses: 1, decalageMs: 11 * 60_000 });
    await monter(<TestsToeic />);
    expect(await screen.findByText(t.tests.reprise.termineTitre)).toBeTruthy();
    await fireEvent.press(screen.getByText(t.tests.reprise.bilan));
    expect(router.push).toHaveBeenCalledWith('/certification/mini-bilan');
  });

  it('test périmé : abandonné automatiquement, l’élève en est informé', async () => {
    installer({ abandon: { rembourse: false } });
    await semer({ decalageMs: (10 + reglages.repriseToleranceMin + 1) * 60_000 });
    await monter(<TestsToeic />);
    expect(await screen.findByText(t.tests.abandonne)).toBeTruthy();
    expect(fausse.appels.abandons[0]).toMatchObject({ raison: 'expired' });
    expect(await lireMini()).toBeNull();
    expect(screen.queryByText(t.tests.reprise.titre)).toBeNull();
  });

  it('thème sombre', async () => {
    await semer();
    await monter(<TestsToeic />, 'sombre');
    expect(await screen.findByText(t.tests.reprise.titre)).toBeTruthy();
  });
});

describe('T2 · réglage d’un mini-test', () => {
  it('le bouton attend un choix ; une partie 1 à 4 n’offre que 10 questions ; le coût suit la longueur', async () => {
    await monter(<ReglageMini />);
    await screen.findByText(t.mini.commencer);
    expect(screen.getByRole('button', { name: t.mini.commencer }).props.accessibilityState?.disabled ?? true).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Partie 2'));
    expect(screen.getByLabelText(t.mini.longueurLabel.replace('{{n}}', '20')).props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText(fr.credits.coutUn)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(t.mini.mixte));
    await fireEvent.press(screen.getByLabelText(t.mini.longueurLabel.replace('{{n}}', '20')));
    expect(screen.getByText(fr.credits.cout.replace('{{n}}', '2'))).toBeTruthy();
    expect(screen.getByText(t.mini.tempsAide.replace('{{min}}', String(2 * reglages.miniMinutesPour10)).replace('{{n}}', '20'))).toBeTruthy();
  });

  it('mode Entraînement : le choix est transmis à l’écran du mini-test', async () => {
    await monter(<ReglageMini />);
    await fireEvent.press(await screen.findByLabelText('Partie 5'));
    await fireEvent.press(screen.getByText(t.mini.modeEntrainement));
    await fireEvent.press(screen.getByText(t.mini.commencer));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/certification/mini-test', params: { epreuve: 'entrainement' } }));
  });

  it('départ : le serveur tire et débite, l’état est gardé, l’écran d’examen s’ouvre', async () => {
    await monter(<ReglageMini />);
    await fireEvent.press(await screen.findByLabelText('Partie 5'));
    await fireEvent.press(screen.getByText(t.mini.commencer));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/certification/mini-test', params: { epreuve: 'examen' } }));
    expect(fausse.appels.minis).toEqual([{ partie: 5, longueur: 10 }]);
    expect((await lireMini())?.partie).toBe(5);
    expect(suivre).toHaveBeenCalledWith('cert_mock_started', { kind: 'mini' });
    expect(suivre).toHaveBeenCalledWith('cert_credit_spent', { action: 'cert_mock_mini_ten', cout: 1 });
    expect(mockRafraichir).toHaveBeenCalled();
  });

  it('mode mixte demandé depuis T1 : le mixte est présélectionné', async () => {
    mockParams = { mode: 'mixte' };
    await monter(<ReglageMini />);
    await screen.findByText(t.mini.commencer);
    expect(screen.getByLabelText(t.mini.mixte).props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText(t.mini.longueurLabel.replace('{{n}}', '20')).props.accessibilityState.checked).toBe(true);
  });

  it('solde trop bas : la feuille de coût s’ouvre avant tout appel, rien n’est débité', async () => {
    mockSolde = 0;
    await monter(<ReglageMini />);
    await fireEvent.press(await screen.findByLabelText('Partie 5'));
    await fireEvent.press(screen.getByText(t.mini.commencer));
    expect(await screen.findByText(t.mini.insuffisantTitre.replace('{{cout}}', fr.credits.coutUn))).toBeTruthy();
    expect(screen.getByText(t.mini.insuffisantSolde.replace('{{n}}', '0'))).toBeTruthy();
    expect(fausse.appels.minis).toHaveLength(0);
    expect(suivre).toHaveBeenCalledWith('cert_credit_gate_viewed', { action: 'cert_mock_mini_ten' });
  });

  it('le serveur refuse faute de crédits : même feuille, aucune tentative gardée', async () => {
    installer({ mini: 'insufficient' });
    await monter(<ReglageMini />);
    await fireEvent.press(await screen.findByLabelText('Partie 5'));
    await fireEvent.press(screen.getByText(t.mini.commencer));
    expect(await screen.findByText(t.mini.insuffisantTexte)).toBeTruthy();
    expect(await lireMini()).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('invité : le serveur demande un compte', async () => {
    installer({ mini: 'account_required' });
    await monter(<ReglageMini />);
    await fireEvent.press(await screen.findByLabelText('Partie 5'));
    await fireEvent.press(screen.getByText(t.mini.commencer));
    expect(await screen.findByText(t.mini.compteTitre)).toBeTruthy();
    await fireEvent.press(screen.getByText(t.mini.compteBouton));
    expect(router.push).toHaveBeenCalledWith('/compte/creer');
  });

  it('échec du serveur : message qui dit qu’aucun crédit n’a été retiré', async () => {
    installer({ mini: 'echec' });
    await monter(<ReglageMini />);
    await fireEvent.press(await screen.findByLabelText('Partie 5'));
    await fireEvent.press(screen.getByText(t.mini.commencer));
    expect(await screen.findByText(t.mini.erreurTexte)).toBeTruthy();
    expect(await lireMini()).toBeNull();
  });

  it('un test est déjà en cours : on ne peut pas en commencer un autre', async () => {
    await semer();
    await monter(<ReglageMini />);
    expect(await screen.findByText(t.mini.enCoursTitre)).toBeTruthy();
    await fireEvent.press(screen.getByText(t.mini.enCoursBouton));
    expect(router.replace).toHaveBeenCalledWith('/tests');
  });

  it('avec le Pass : le coût est « inclus » et aucune feuille ne s’ouvre', async () => {
    mockPass = true;
    mockSolde = 0;
    await monter(<ReglageMini />);
    expect(await screen.findByText(t.mini.coutPass)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Partie 5'));
    await fireEvent.press(screen.getByText(t.mini.commencer));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/certification/mini-test', params: { epreuve: 'examen' } }));
  });

  it('thème sombre', async () => {
    await monter(<ReglageMini />, 'sombre');
    expect(await screen.findByText(t.mini.commencer)).toBeTruthy();
  });
});

describe('écran d’examen', () => {
  it('reste sombre dans le thème clair, sans effet de bord sur le thème de l’app', async () => {
    function Sonde({ nom }: { nom: string }) {
      const { sombre } = useTheme();
      return <Text>{`${nom}:${sombre}`}</Text>;
    }
    await monter(
      <>
        <Sonde nom="dehors" />
        <ForcerSombre>
          <Sonde nom="dedans" />
        </ForcerSombre>
      </>,
      'clair',
    );
    expect(screen.getByText('dehors:false')).toBeTruthy();
    expect(screen.getByText('dedans:true')).toBeTruthy();
  });

  it('déroule les questions sans correction puis ouvre le bilan', async () => {
    await semer();
    await monter(<MiniTest />);
    expect(await screen.findByText(t.examen.entete.replace('{{n}}', '1').replace('{{total}}', '3'))).toBeTruthy();
    expect(screen.getByText(t.examen.sansCorrection)).toBeTruthy();
    // 3 questions servies par la fausse banque : le chrono affiche la durée au servi, 3 minutes.
    expect(screen.getByText('03:00')).toBeTruthy();
    for (let i = 0; i < 3; i++) {
      await fireEvent.press(await screen.findByText(/^A\b/));
      await fireEvent.press(screen.getByText(i === 2 ? t.examen.derniere : t.examen.suivante));
    }
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/certification/mini-bilan'));
    const etat = await lireMini();
    expect(etat?.reponses).toHaveLength(3);
    expect(etat?.termine).toBe(true);
    expect(screen.queryByText(fr.certification.explication.badge)).toBeNull();
  });

  it('sans réponse : « Question suivante » passe la question, qui compte fausse au bilan', async () => {
    await semer();
    await monter(<MiniTest />);
    expect(screen.queryByText(t.examen.passer)).toBeNull();
    await fireEvent.press(await screen.findByText(t.examen.suivante));
    await waitFor(async () => expect((await lireMini())?.reponses[0]?.chosen).toBeNull());
    expect(screen.getByText(t.examen.sansCorrection)).toBeTruthy();
  });

  it('temps écoulé : les réponses données sont gardées et le bilan s’ouvre', async () => {
    await semer({ reponses: 1, decalageMs: 11 * 60_000 });
    await monter(<MiniTest />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/certification/mini-bilan'));
    const etat = await lireMini();
    expect(etat?.termine).toBe(true);
    expect(etat?.reponses).toHaveLength(1);
  });

  it('quitter demande confirmation et garde les réponses', async () => {
    await semer();
    await monter(<MiniTest />);
    await fireEvent.press(await screen.findByLabelText(t.retour));
    expect(await screen.findByText(t.examen.quitterTitre)).toBeTruthy();
    await fireEvent.press(screen.getByText(t.examen.quitter));
    expect(router.replace).toHaveBeenCalledWith('/tests');
    expect(await lireMini()).not.toBeNull();
  });

  it('aucun test en cours : message et retour aux tests', async () => {
    await monter(<MiniTest />);
    expect(await screen.findByText(t.examen.erreurTitre)).toBeTruthy();
    await fireEvent.press(screen.getByText(t.examen.retour));
    expect(router.replace).toHaveBeenCalledWith('/tests');
  });
});

describe('bilan réduit', () => {
  it('mini-test mixte : estimation large, jamais présentée comme un score officiel', async () => {
    const e = await semer({ partie: null, reponses: 3 });
    await ecrireMini({ ...e, termine: true });
    await monter(<BilanMini />);
    expect(await screen.findByText('700')).toBeTruthy();
    expect(screen.getByText(t.bilanMini.scoreEstime)).toBeTruthy();
    expect(screen.getByText(t.bilanMini.estimationAide)).toBeTruthy();
    expect(screen.getByText(t.bilanMini.ecouteLecture)).toBeTruthy();
    expect(screen.getByText(t.bilanMini.revoir)).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('cert_mock_completed', { kind: 'mini', score_min: 650, score_max: 730 });
    expect(fausse.appels.terminer).toBe(1);
  });

  it('mini-test par partie : un score « x sur n », pas d’estimation sur 990', async () => {
    const e = await semer({ partie: 5, reponses: 3 });
    await ecrireMini({ ...e, termine: true });
    await monter(<BilanMini />);
    expect(await screen.findByText(t.bilanMini.sansEstimation)).toBeTruthy();
    expect(screen.getAllByText('3 sur 3').length).toBeGreaterThan(0);
    expect(screen.queryByText('700')).toBeNull();
    expect(screen.queryByText(t.bilanMini.ecouteLecture)).toBeNull();
    expect(suivre).toHaveBeenCalledWith('cert_mock_completed', { kind: 'mini', score_min: null, score_max: null });
  });

  it('sans réseau : le bilan attend, puis se calcule au nouvel essai', async () => {
    installer({ echecsTerminer: 1 });
    const e = await semer({ partie: 5, reponses: 3 });
    await ecrireMini({ ...e, termine: true });
    await monter(<BilanMini />);
    expect(await screen.findByText(t.bilanMini.attenteTitre)).toBeTruthy();
    await fireEvent.press(screen.getByText(t.bilanMini.reessayer));
    expect((await screen.findAllByText('3 sur 3')).length).toBeGreaterThan(0);
  });

  it('« Revenir aux tests » efface le test terminé', async () => {
    const e = await semer({ partie: 5, reponses: 3 });
    await ecrireMini({ ...e, termine: true });
    await monter(<BilanMini />);
    await fireEvent.press(await screen.findByText(t.bilanMini.retour));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/tests'));
    expect(await lireMini()).toBeNull();
  });

  it('thème sombre', async () => {
    const e = await semer({ partie: 5, reponses: 3 });
    await ecrireMini({ ...e, termine: true });
    await monter(<BilanMini />, 'sombre');
    expect((await screen.findAllByText('3 sur 3')).length).toBeGreaterThan(0);
  });
});

describe('T4 · historique et T7 · détail', () => {
  const liste = [
    LIGNE({ id: 'a', part: null, scoreMin: 650, scoreMax: 730, perPart: { '1': { answered: 5, correct: 4 }, '5': { answered: 15, correct: 10 } } }),
    LIGNE({ id: 'b' }),
    LIGNE({ id: 'c', status: 'abandoned', perPart: null, finishedAt: null }),
    LIGNE({ id: 'd', kind: 'diagnostic', part: null, length: 20, scoreMin: 600, scoreMax: 700 }),
  ];

  it('liste chaque test avec son résultat, du plus récent au plus ancien, et la mention d’estimation', async () => {
    installer({ tentatives: liste });
    await monter(<HistoriqueTests />);
    expect(await screen.findByText(`${t.historique.miniMixte} · estimation 650 à 730`)).toBeTruthy();
    expect(screen.getByText(`${t.historique.miniPartie.replace('{{n}}', '5')} · 8 sur 10`)).toBeTruthy();
    expect(screen.getByText(`${t.historique.miniPartie.replace('{{n}}', '5')} · ${t.historique.abandonne}`)).toBeTruthy();
    expect(screen.getByText(`${t.historique.diagnostic} · estimation 600 à 700`)).toBeTruthy();
    expect(screen.getByText(t.historique.mention)).toBeTruthy();
    expect(screen.getByText('650 à 730 sur 990')).toBeTruthy();
  });

  it('ouvre le détail d’une tentative', async () => {
    installer({ tentatives: liste });
    await monter(<HistoriqueTests />);
    await fireEvent.press(await screen.findByText(`${t.historique.miniMixte} · estimation 650 à 730`));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/tentative/[id]', params: { id: 'a' } });
  });

  it('aucun test : encadré vide', async () => {
    await monter(<HistoriqueTests />);
    expect(await screen.findByText(`${t.historique.vide} ${t.historique.videAide}`)).toBeTruthy();
  });

  it('historique injoignable : message et nouvel essai', async () => {
    installer({ tentatives: 'echec' });
    await monter(<HistoriqueTests />);
    expect(await screen.findByText(t.historique.erreurTitre)).toBeTruthy();
  });

  it('détail : score, temps et résultat par partie', async () => {
    installer({ tentatives: liste });
    mockParams = { id: 'a' };
    await monter(<DetailTentative />);
    expect(await screen.findByText('estimation 650 à 730')).toBeTruthy();
    expect(screen.getByText(t.tentative.minutes.replace('{{min}}', '8'))).toBeTruthy();
    expect(screen.getByText(t.tentative.lignePartie.replace('{{n}}', '1'))).toBeTruthy();
    expect(screen.getByText('10 sur 15')).toBeTruthy();
  });

  it('détail d’un test abandonné : pas de bilan', async () => {
    installer({ tentatives: liste });
    mockParams = { id: 'c' };
    await monter(<DetailTentative />);
    expect(await screen.findByText(t.tentative.abandonne)).toBeTruthy();
  });

  it('détail d’un test inconnu', async () => {
    installer({ tentatives: liste });
    mockParams = { id: 'zzz' };
    await monter(<DetailTentative />);
    expect(await screen.findByText(t.tentative.absent)).toBeTruthy();
  });

  it('thème sombre', async () => {
    installer({ tentatives: liste });
    await monter(<HistoriqueTests />, 'sombre');
    expect(await screen.findByText(t.historique.mention)).toBeTruthy();
  });
});

describe('T6 · test complet « Bientôt »', () => {
  it('sans test listé, le lancement reste grisé ; pas de lien hors maquette', async () => {
    mockParams = { kind: 'full' };
    await monter(<TestBientot />);
    expect(await screen.findByText(t.tests.completTexte)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.tests.bientotLancer }).props.accessibilityState?.disabled).toBe(true);
    expect(screen.queryByText('Faire un mini-test')).toBeNull();
  });
});

describe('revue de l’Examen terminé', () => {
  it('une question à la fois, bonne réponse et réponse de l’élève, puis retour aux tests', async () => {
    const e = await semer({ partie: 5, reponses: 3 });
    await ecrireMini({ ...e, termine: true });
    await monter(<BilanMini />);
    await fireEvent.press(await screen.findByText(t.bilanMini.revoir));
    await monter(<MiniRevue />);
    expect(await screen.findByText(t.revue.position.replace('{{n}}', '1').replace('{{total}}', '3'))).toBeTruthy();
    expect(screen.getByText(t.revue.corrige)).toBeTruthy();
    expect(screen.getAllByText(t.exercice.grilleJuste).length).toBeGreaterThan(0);
    expect(screen.queryByText(t.revue.sansReponse)).toBeNull();
    await fireEvent.press(screen.getByText(t.revue.suivante));
    await fireEvent.press(screen.getByText(t.revue.suivante));
    await fireEvent.press(await screen.findByText(t.revue.terminer));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/tests'));
    expect(await lireMini()).toBeNull();
  });

  it('une question sans réponse le dit au lieu de montrer une réponse de l’élève', async () => {
    const e = await semer({ partie: 5, reponses: 0 });
    await ecrireMini({ ...e, termine: true });
    await monter(<BilanMini />);
    await fireEvent.press(await screen.findByText(t.bilanMini.revoir));
    await monter(<MiniRevue />);
    expect(await screen.findByText(t.revue.sansReponse)).toBeTruthy();
    expect(screen.getByText(t.revue.sansReponseAide.replace('{{n}}', '1'))).toBeTruthy();
    expect(screen.queryByText(t.exercice.grilleTienne)).toBeNull();
  });

  it('sans test terminé : retour aux tests', async () => {
    await monter(<MiniRevue />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/tests'));
  });
});
