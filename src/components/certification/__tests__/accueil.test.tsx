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
import { jourDe } from '@/services/certification/jours';
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
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), definirProprietesUtilisateur: jest.fn(), drapeauActif: jest.fn(() => mockDrapeau), ecouterDrapeaux: jest.fn(() => () => {}) }));
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
  it('montre le compteur et le parcours du jour, sans carte verte « Séance du jour » (maquette N1 v5 : une seule porte pour aujourd’hui)', async () => {
    await monter(<AccueilToeic />);
    expect(await screen.findByText(t.accueilToeic.compteJours.replace('{{n}}', '42'))).toBeTruthy();
    expect(screen.queryByText(t.accueilToeic.seanceTitre)).toBeNull();
    expect(screen.queryByText(t.accueilToeic.minutesCourtes.replace('{{minutes}}', '20'))).toBeNull();
    // Retouche de novembre 2026 : plus de cartes « Score estimé » et « Mots à revoir », ni de phrase du plan sous le compteur.
    expect(screen.queryByText(t.accueilToeic.score)).toBeNull();
    expect(screen.queryByText(t.accueilToeic.scoreExact.replace('{{score}}', '700'))).toBeNull();
    expect(screen.queryByText(/Ton plans*:/)).toBeNull();
    // Parcours du jour : ligne « Aujourd’hui · date » puis les étapes du jour (repli local : mini-test).
    expect(await screen.findByText(/^Aujourd’hui · /)).toBeTruthy();
    expect((await screen.findAllByText(fr.certification.monPlan.miniLocal)).length).toBeGreaterThan(0);
    expect(screen.queryByText(t.accueilToeic.parties)).toBeNull();
  });

  it('le chip changeur de profil remplace le titre « Accueil » et ouvre la page de changement', async () => {
    await monter(<AccueilToeic />);
    // Même chip que les accueils élève et concours : libellé court de l'examen du profil (TOEIC),
    // libellé d'accessibilité dédié à la certification, et plus de titre « Accueil » dans l'en-tête.
    const chip = await screen.findByRole('button', { name: fr.classe.selecteurCertificationA11y.replace('{{classe}}', 'TOEIC') });
    expect(chip).toBeTruthy();
    expect(screen.getByText('TOEIC')).toBeTruthy();
    expect(screen.queryByText(t.accueilToeic.entete)).toBeNull();
    await fireEvent.press(chip);
    expect(router.push).toHaveBeenCalledWith('/profil/changer');
  });

  it('la carte Test dans garde le compteur et sa barre de la semaine, sans phrase sous le compteur', async () => {
    await AsyncStorage.setItem('cert.seancesFaites', JSON.stringify([{ clientUuid: 'x', jour: jourDe(new Date()) }]));
    await monter(<AccueilToeic />);
    expect(await screen.findByText(t.accueilToeic.compteJours.replace('{{n}}', '42'))).toBeTruthy();
    expect(screen.getByLabelText(t.accueilToeic.planBarre)).toBeTruthy();
    expect(screen.queryByText(t.accueilToeic.planSemaine.replace('{{prevues}}', '3').replace('{{faites}}', '1'))).toBeNull();
  });

  it('sans date de test : pas de carte du compteur et pas de phrase du plan', async () => {
    await ecrirePlan({ exam: 'toeic', objectif: 800, minutes: 20 }, { effacerDate: true });
    await monter(<AccueilToeic />);
    expect(await screen.findByText(t.accueilToeic.sansDateTitre)).toBeTruthy();
    expect(screen.queryByText(t.accueilToeic.planSemaine.replace('{{prevues}}', '3').replace('{{faites}}', '0'))).toBeNull();
    expect(screen.queryByText(t.accueilToeic.compteEtiquette)).toBeNull();
  });

  it('sans date de test : invitation en pointillés « Ajoute la date de ton examen » qui ouvre l’objectif (V30-ACCUEIL-SANS-DATE)', async () => {
    await ecrirePlan({ exam: 'toeic', objectif: 800, minutes: 20 }, { effacerDate: true });
    await monter(<AccueilToeic />);
    expect(await screen.findByText(t.accueilToeic.sansDateTitre)).toBeTruthy();
    expect(screen.getByText(t.accueilToeic.sansDateAide)).toBeTruthy();
    await fireEvent.press(screen.getByText(t.accueilToeic.sansDateTitre));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/objectif', params: { modifier: '1' } });
  });

  it('avec la date du profil : « Test dans 42 jours », la date, la barre de la semaine et pas d’invitation', async () => {
    await monter(<AccueilToeic />);
    expect(await screen.findByText(t.accueilToeic.compteEtiquette)).toBeTruthy();
    expect(screen.getByText(t.accueilToeic.compteJours.replace('{{n}}', '42'))).toBeTruthy();
    expect(screen.getByText(t.accueilToeic.compteDate.replace('{{date}}', '27 novembre 2026'))).toBeTruthy();
    expect(screen.getByLabelText(t.accueilToeic.planBarre)).toBeTruthy();
    expect(screen.queryByText(t.accueilToeic.sansDateTitre)).toBeNull();
  });

  it('le bouton fixe en bas lance l’étape en cours du parcours du jour', async () => {
    await monter(<AccueilToeic />);
    await screen.findByText(/^Aujourd’hui · /);
    await fireEvent.press(await screen.findByText(/^Commencer · /));
    expect(router.push).toHaveBeenCalled();
  });

  it('propose de reprendre une série interrompue', async () => {
    await AsyncStorage.setItem('cert.serie', JSON.stringify({ clientUuid: 'c', exam: 'toeic', perimetre: { part: 5 }, questions: new Array(10).fill({ id: 'q' }), index: 6, reponses: [], resultats: {}, enAttente: [], motsAjoutes: [], termine: false }));
    await monter(<AccueilToeic />);
    expect(await screen.findByText(t.accueilToeic.serieInterrompue)).toBeTruthy();
    expect(screen.getByText(t.accueilToeic.serieAide.replace('{{partie}}', '5').replace('{{k}}', '6').replace('{{n}}', '10'))).toBeTruthy();
  });

  it('ne répète plus le score estimé sur l’accueil', async () => {
    await AsyncStorage.setItem('cert.diagnostic', JSON.stringify({ clientUuid: 'd', tentative: null, reponses: [], index: 0, termine: true, fin: { status: 'finished', attempt_id: 'a', kind: 'diagnostic', estimated: true, score: 700, score_min: 650, score_max: 730, per_part: {}, results: [], replay: false } }));
    await monter(<AccueilToeic />);
    expect(await screen.findByText(t.accueilToeic.compteJours.replace('{{n}}', '42'))).toBeTruthy();
    expect(screen.queryByText(t.accueilToeic.scoreExact.replace('{{score}}', '700'))).toBeNull();
  });

  it('garde l’accueil lisible quand la séance ne peut pas être composée : le parcours du jour reste là', async () => {
    installer({ seance: 'echec' });
    await monter(<AccueilToeic />);
    expect(await screen.findByText(/^Aujourd’hui · /)).toBeTruthy();
    expect(screen.queryByText(t.accueilToeic.erreurTitre)).toBeNull();
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

  it('bloc série en partie 6 au budget de base : l’aide annonce les 12 questions servies, pas le budget (I-4)', async () => {
    installer({ seance: { minutes: 20, blocs: [{ type: 'serie', partie: 6, nombre: 10 }], pourquoi: { erreurs: 0, notion: null, motsEchus: 0 } } });
    await monter(<SeanceDuJour />);
    expect(await screen.findByText(t.seanceJour.serie)).toBeTruthy();
    expect(screen.getByText(t.seanceJour.serieAide.replace('{{partie}}', '6').replace('{{n}}', '12'))).toBeTruthy();
    expect(screen.queryByText(t.seanceJour.serieAide.replace('{{partie}}', '6').replace('{{n}}', '10'))).toBeNull();
  });

  it('bloc série en partie 6 au budget 5 : l’aide reste au budget (maximum atteignable non dérivable côté app)', async () => {
    installer({ seance: { minutes: 10, blocs: [{ type: 'serie', partie: 6, nombre: 5 }], pourquoi: { erreurs: 0, notion: null, motsEchus: 0 } } });
    await monter(<SeanceDuJour />);
    expect(await screen.findByText(t.seanceJour.serie)).toBeTruthy();
    expect(screen.getByText(t.seanceJour.serieAide.replace('{{partie}}', '6').replace('{{n}}', '5'))).toBeTruthy();
  });

  it('séance vide : message dédié', async () => {
    installer({ seance: { minutes: 20, blocs: [], pourquoi: { erreurs: 0, notion: null, motsEchus: 0 } } });
    await monter(<SeanceDuJour />);
    expect(await screen.findByText(t.seanceJour.vide)).toBeTruthy();
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

  it('TOEIC dès l’arrivée (objectif et temps), même sans diagnostic terminé', async () => {
    await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: false });
    await monter(<Sonde />);
    expect(await screen.findByText('toeic')).toBeTruthy();
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
    expect(await screen.findByText(t.arrivee.contientEcouteTitre)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.arrivee.commencer })).toBeTruthy();
    expect(screen.queryByText(t.accueilToeic.minutesCourtes.replace('{{minutes}}', '20'))).toBeNull();
    expect(screen.queryByText(t.accueilToeic.parties)).toBeNull();
    expect(screen.queryByText(t.arrivee.donneTitre)).toBeNull();
  });
  it('« Commencer le diagnostic » ouvre le diagnostic', async () => {
    await monter(<AccueilToeic />);
    await fireEvent.press(await screen.findByRole('button', { name: t.arrivee.commencer }));
    expect(router.push).toHaveBeenCalledWith('/certification/diagnostic');
  });
});
