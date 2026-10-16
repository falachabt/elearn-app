import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Text } from 'react-native';

import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import { JOUR, MOTS_TEST, REVISION_TEST, SEANCE_TEST } from '@/services/certification/__tests__/fixturesRevision';
import { ecrireDiagnostic, ecrirePlan } from '@/services/certification/etat';
import { lireSeanceJour, terminerBloc } from '@/services/certification/seanceJour';
import { enregistrerProfil } from '@/services/profil';

import { AccueilToeic } from '../AccueilToeic';
import { MoiToeic } from '../MoiToeic';
import { SeanceDuJour } from '../SeanceDuJour';
import { useProfilToeic } from '../useProfilToeic';
import { monter } from './harnais';

const t = fr.certification;

let mockParams: Record<string, string> = {};
let mockDrapeau = true;
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => cb(), [cb]);
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), drapeauActif: jest.fn(() => mockDrapeau), ecouterDrapeaux: jest.fn(() => () => {}) }));
let mockCompteur = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockCompteur}` }));
jest.mock('../../credits/CompteurCredits', () => ({ CompteurCredits: () => null }));
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
  fausse = creerApiFausse({ revision: REVISION_TEST, carnet: MOTS_TEST, seance: SEANCE_TEST, ...options });
  definirApi(fausse.api);
};
const HORS_LIGNE = { doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'clearTimeout', 'clearInterval', 'nextTick', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame'] as ('setTimeout' | 'setInterval' | 'setImmediate' | 'clearTimeout' | 'clearInterval' | 'nextTick' | 'queueMicrotask' | 'requestAnimationFrame' | 'cancelAnimationFrame')[] };

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(`${JOUR}T10:00:00`), ...HORS_LIGNE });
  jest.clearAllMocks();
  mockCompteur = 0;
  mockParams = {};
  mockDrapeau = true;
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: true });
  await ecrirePlan({ exam: 'toeic', objectif: 800, dateTest: '2026-11-27', minutes: 20 });
  installer();
});
afterEach(() => {
  definirApi(null);
  jest.useRealTimers();
});

describe('N1 · Accueil TOEIC', () => {
  beforeEach(async () => {
    // Accueil d'un élève qui a fini son diagnostic : c'est le seul cas où les cartes de séance s'affichent.
    await ecrireDiagnostic({ fin: { estimated: true, score: 700, score_min: 650, score_max: 730 } } as never);
  });
  it('montre objectif, séance du jour avec sa raison, mots à revoir et accès rapides', async () => {
    await monter(<AccueilToeic />);
    expect(await screen.findByText(t.accueilToeic.objectifJours.replace('{{score}}', '800').replace('{{n}}', '42'))).toBeTruthy();
    expect(screen.getByText(t.accueilToeic.seanceEtiquette.replace('{{minutes}}', '20'))).toBeTruthy();
    expect(screen.getByText(t.accueilToeic.pourquoiMots.replace('{{n}}', '4').replace('{{notion}}', 'Prépositions de temps').replace('{{m}}', '2'))).toBeTruthy();
    expect(screen.getByText(t.accueilToeic.motsN.replace('{{n}}', '2'))).toBeTruthy();
    expect(screen.getByText(t.accueilToeic.scorePlage.replace('{{min}}', '650').replace('{{max}}', '730'))).toBeTruthy();
    expect(screen.getByText(t.accueilToeic.parties)).toBeTruthy();
  });

  it('« Commencer la séance » ouvre D2, « Continuer » une fois un bloc terminé', async () => {
    await monter(<AccueilToeic />);
    await fireEvent.press(await screen.findByText(t.accueilToeic.commencer));
    expect(router.push).toHaveBeenCalledWith('/certification/seance');
    const etat = await lireSeanceJour();
    await terminerBloc(etat!, 0);
    await monter(<AccueilToeic />);
    expect((await screen.findAllByText(t.accueilToeic.continuer)).length).toBeGreaterThan(0);
  });

  it('propose de reprendre une série interrompue', async () => {
    await AsyncStorage.setItem('cert.serie', JSON.stringify({ clientUuid: 'c', exam: 'toeic', perimetre: { part: 5 }, questions: new Array(10).fill({ id: 'q' }), index: 6, reponses: [], resultats: {}, enAttente: [], motsAjoutes: [], termine: false }));
    await monter(<AccueilToeic />);
    expect(await screen.findByText(t.accueilToeic.serieInterrompue)).toBeTruthy();
    expect(screen.getByText(t.accueilToeic.serieAide.replace('{{partie}}', '5').replace('{{k}}', '6').replace('{{n}}', '10'))).toBeTruthy();
  });

  it('affiche la fourchette du dernier diagnostic', async () => {
    await AsyncStorage.setItem('cert.diagnostic', JSON.stringify({ clientUuid: 'd', tentative: null, reponses: [], index: 0, termine: true, fin: { status: 'finished', attempt_id: 'a', kind: 'diagnostic', estimated: true, score: 700, score_min: 650, score_max: 730, per_part: {}, results: [], replay: false } }));
    await monter(<AccueilToeic />);
    expect(await screen.findByText(t.accueilToeic.scorePlage.replace('{{min}}', '650').replace('{{max}}', '730'))).toBeTruthy();
  });

  it('garde l’accueil lisible quand la séance ne peut pas être composée', async () => {
    installer({ seance: 'echec' });
    await monter(<AccueilToeic />);
    expect(await screen.findByText(t.accueilToeic.erreurTitre)).toBeTruthy();
    expect(screen.getByText(t.accueilToeic.parties)).toBeTruthy();
  });

  it('propose de réessayer quand tout échoue', async () => {
    installer({ revision: 'echec' });
    await monter(<AccueilToeic />, 'sombre');
    expect(await screen.findByText(t.reessayer)).toBeTruthy();
  });
});

describe('D2 · Séance du jour', () => {
  it('liste les blocs dans l’ordre avec la raison et lance le cours en premier', async () => {
    await monter(<SeanceDuJour />);
    expect(await screen.findByText(t.seanceJour.cours)).toBeTruthy();
    expect(screen.getByText(t.seanceJour.avancement.replace('{{k}}', '0').replace('{{b}}', '4'))).toBeTruthy();
    await fireEvent.press(screen.getByText(t.seanceJour.commencer));
    expect(suivre).toHaveBeenCalledWith('cert_session_started', { composition: 'cours,mots,rejeu,serie' });
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/notion/[id]', params: { id: 'n-prepo', source: 'seance' } });
    expect((await lireSeanceJour())?.termines).toEqual([0]);
  });

  it('lance les blocs suivants avec leur origine et leur taille', async () => {
    await monter(<SeanceDuJour />);
    await fireEvent.press(await screen.findByText(t.seanceJour.commencer));
    await monter(<SeanceDuJour />);
    await fireEvent.press(await screen.findByText(t.seanceJour.continuer));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/certification/mots-seance', params: { origine: 'seance', nombre: '2' } });
  });

  it('change la durée avant de commencer et recompose la séance', async () => {
    await monter(<SeanceDuJour />);
    await fireEvent.press(await screen.findByText(t.seanceJour.changerDuree));
    await fireEvent.press(await screen.findByText(t.seanceJour.dureeMinutes.replace('{{n}}', '10')));
    await waitFor(() => expect(fausse.appels.compositions.map((c) => c.minutes)).toEqual([20, 10]));
  });

  it('fige la durée une fois la séance commencée', async () => {
    await monter(<SeanceDuJour />);
    await fireEvent.press(await screen.findByText(t.seanceJour.commencer));
    await monter(<SeanceDuJour />);
    expect(await screen.findByText(t.seanceJour.dureeFigee)).toBeTruthy();
  });

  it('enregistre la séance à la fin du dernier bloc et la rend en lecture seule', async () => {
    await monter(<SeanceDuJour />);
    await screen.findByText(t.seanceJour.cours);
    let etat = (await lireSeanceJour())!;
    for (let i = 0; i < 4; i++) etat = await terminerBloc(etat, i);
    expect(fausse.appels.seances).toHaveLength(1);
    await monter(<SeanceDuJour />);
    expect(await screen.findByText(t.seanceJour.terminee)).toBeTruthy();
    await fireEvent.press(screen.getByText(t.seanceJour.retourAccueil));
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('propose de réessayer si la séance ne peut pas être composée', async () => {
    installer({ seance: 'echec' });
    await monter(<SeanceDuJour />, 'sombre');
    expect(await screen.findByText(t.seanceJour.erreurTitre)).toBeTruthy();
  });

  it('séance vide : message dédié', async () => {
    installer({ seance: { minutes: 20, blocs: [], pourquoi: { erreurs: 0, notion: null, motsEchus: 0 } } });
    await monter(<SeanceDuJour />);
    expect(await screen.findByText(t.seanceJour.vide)).toBeTruthy();
  });
});

describe('N2 · Moi, profil TOEIC', () => {
  it('résume l’objectif et le temps par jour, et ouvre l’édition sans repasser par l’arrivée', async () => {
    await monter(<MoiToeic />);
    expect(await screen.findByText(t.moiToeic.tempsAide.replace('{{n}}', '20'))).toBeTruthy();
    expect(screen.getByText(/Score 800/)).toBeTruthy();
    await fireEvent.press(screen.getByText(t.moiToeic.objectif));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/objectif', params: { modifier: '1' } });
    await fireEvent.press(screen.getByText(t.moiToeic.temps));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/temps', params: { modifier: '1' } });
  });
});

describe('Bascule des onglets selon le profil', () => {
  function Sonde() {
    const v = useProfilToeic();
    return <Text>{v === null ? 'inconnu' : v ? 'toeic' : 'classique'}</Text>;
  }

  it('toeic quand le drapeau est ouvert et le profil terminé', async () => {
    await monter(<Sonde />);
    expect(await screen.findByText('toeic')).toBeTruthy();
  });

  it('classique quand le drapeau est fermé', async () => {
    mockDrapeau = false;
    await monter(<Sonde />);
    expect(await screen.findByText('classique')).toBeTruthy();
  });

  it('classique tant que le diagnostic n’est pas vu (profil pas terminé)', async () => {
    await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: false });
    await monter(<Sonde />);
    expect(await screen.findByText('classique')).toBeTruthy();
  });

  it('classique pour un élève', async () => {
    await enregistrerProfil({ type: 'eleve', niveau: '1re', pays: 'CM', termine: true });
    await monter(<Sonde />);
    expect(await screen.findByText('classique')).toBeTruthy();
  });
});

describe('S7 · Mon TOEIC avant diagnostic', () => {
  it('montre seulement la préparation et le bouton, sans cartes de séance, cours ni carnet', async () => {
    await monter(<AccueilToeic />);
    expect(await screen.findByText(t.arrivee.contientTitre)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.arrivee.commencer })).toBeTruthy();
    expect(screen.queryByText(t.accueilToeic.seanceEtiquette.replace('{{minutes}}', '20'))).toBeNull();
    expect(screen.queryByText(t.accueilToeic.parties)).toBeNull();
    expect(screen.queryByText(t.arrivee.donneTitre)).toBeNull();
  });
  it('« Commencer le diagnostic » ouvre le diagnostic', async () => {
    await monter(<AccueilToeic />);
    await fireEvent.press(await screen.findByRole('button', { name: t.arrivee.commencer }));
    expect(router.push).toHaveBeenCalledWith('/certification/diagnostic');
  });
});
