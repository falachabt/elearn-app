import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { definirApi } from '@/services/certification/api';
import { lirePlan } from '@/services/certification/etat';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import { enregistrerProfil, lireProfil } from '@/services/profil';

import { Bienvenue } from '../../ParcoursArrivee';
import { ArriveeToeic } from '../ArriveeToeic';
import { ChoixCertification } from '../ChoixCertification';
import { ObjectifCertification } from '../ObjectifCertification';
import { TempsParJour } from '../TempsParJour';
import { attendre, monter } from './harnais';

const t = fr.certification;
let mockDrapeau = true;

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/services/analytics', () => ({
  suivre: jest.fn(), definirProprietesUtilisateur: jest.fn(),
  drapeauActif: jest.fn(() => mockDrapeau),
  ecouterDrapeaux: jest.fn(() => () => {}),
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
jest.mock('expo-localization', () => ({ getLocales: () => [{ regionCode: 'CM' }] }));

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockDrapeau = true;
  definirApi(creerApiFausse().api);
});
afterEach(() => definirApi(null));

describe('A1 · Bienvenue', () => {
  it('AC-A1-1 : trois cartes dans l’ordre Élève, Concours, Certification', async () => {
    await monter(<Bienvenue />);
    const noms = [fr.bienvenue.eleve, fr.bienvenue.concours, t.carte].map((n) => screen.getByRole('button', { name: n }));
    expect(noms).toHaveLength(3);
    expect(screen.getByText(t.carteAide)).toBeTruthy();
  });
  it('AC-A1-2 : les textes Élève et Concours restent ceux de fr.ts', async () => {
    await monter(<Bienvenue />);
    expect(screen.getByText(fr.bienvenue.eleveAide)).toBeTruthy();
    expect(screen.getByText(fr.bienvenue.concoursAide)).toBeTruthy();
  });
  it('AC-A1-3 : drapeau faux, deux cartes seulement', async () => {
    mockDrapeau = false;
    await monter(<Bienvenue />);
    expect(screen.queryByRole('button', { name: t.carte })).toBeNull();
    expect(screen.getByRole('button', { name: fr.bienvenue.eleve })).toBeTruthy();
    expect(screen.getByRole('button', { name: fr.bienvenue.concours })).toBeTruthy();
  });
  it('AC-A1-4 : la carte ouvre A2 sans enregistrer de profil', async () => {
    await monter(<Bienvenue />);
    await fireEvent.press(screen.getByRole('button', { name: t.carte }));
    expect(router.push).toHaveBeenCalledWith('/certification');
    expect(suivre).toHaveBeenCalledWith('onboarding_choice_made', { profil: 'certification' });
    expect(await lireProfil()).toBeNull();
  });
});

describe('A2 · Choix de la certification', () => {
  it('AC-A2-2 : « Continuer » est inactif tant que rien n’est choisi', async () => {
    await monter(<ChoixCertification />);
    await screen.findByText('TOEIC Listening and Reading');
    expect(screen.getByRole('button', { name: t.continuer }).props.accessibilityState.disabled).toBe(true);
  });
  it('affiche la ligne servie par le serveur : nom, sous-titre, durée et nombre de questions', async () => {
    await monter(<ChoixCertification />);
    expect(await screen.findByText('Anglais des affaires · 2 h · 200 questions')).toBeTruthy();
  });
  it('AC-A2-4 : la mention de non-affiliation accompagne le bouton', async () => {
    await monter(<ChoixCertification />);
    expect(screen.getByText(t.marqueExamen)).toBeTruthy();
  });
  it('AC-A2-6 : l’encadré de maquette n’est jamais affiché', async () => {
    await monter(<ChoixCertification />);
    await screen.findByText('TOEIC Listening and Reading');
    expect(screen.queryByText(/D’autres certifications/)).toBeNull();
  });
  it('choisir puis continuer enregistre le profil (type, examen, pays par défaut) et ouvre A3', async () => {
    await monter(<ChoixCertification />);
    await fireEvent.press(await screen.findByRole('radio', { name: /TOEIC Listening and Reading/ }));
    await fireEvent.press(screen.getByRole('button', { name: t.continuer }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/certification/objectif'));
    expect(await lireProfil()).toMatchObject({ type: 'certification', exam: 'toeic', pays: 'CM', termine: false });
    expect(suivre).toHaveBeenCalledWith('cert_exam_chosen', { examen: 'toeic' });
  });
  it('AC-A2-5 : le retour conserve la sélection', async () => {
    await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'GA', termine: false });
    await monter(<ChoixCertification />);
    const ligne = await screen.findByRole('radio', { name: /TOEIC Listening and Reading/ });
    await waitFor(() => expect(screen.getByRole('radio', { name: /TOEIC Listening and Reading/ }).props.accessibilityState.checked).toBe(true));
    expect(ligne).toBeTruthy();
    expect(screen.getByRole('button', { name: t.continuer }).props.accessibilityState.disabled).toBe(false);
  });
  it('état d’erreur avec « Réessayer » (jamais une impasse)', async () => {
    definirApi({ ...creerApiFausse().api, listerExamens: () => Promise.reject(new Error('réseau')) });
    await monter(<ChoixCertification />);
    expect(await screen.findByText(t.choix.erreurTitre)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.reessayer })).toBeTruthy();
  });
  it('liste vide : état vide expliqué', async () => {
    definirApi({ ...creerApiFausse().api, listerExamens: () => Promise.resolve([]) });
    await monter(<ChoixCertification />);
    expect(await screen.findByText(t.choix.videTitre)).toBeTruthy();
  });
  it('hors ligne avec un cache : la liste du cache s’affiche avec la mention', async () => {
    const { api } = creerApiFausse();
    definirApi(api);
    const { unmount } = await monter(<ChoixCertification />);
    await screen.findByText('TOEIC Listening and Reading');
    await unmount();
    definirApi({ ...api, listerExamens: () => Promise.reject(new Error('hors ligne')) });
    await monter(<ChoixCertification />);
    expect(await screen.findByText('TOEIC Listening and Reading')).toBeTruthy();
    expect(screen.getByText(t.choix.horsLigne)).toBeTruthy();
  });
});

describe('A3 · Objectif', () => {
  const monterObjectif = async () => {
    await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: false });
    await monter(<ObjectifCertification />);
    await screen.findByDisplayValue('800');
    await screen.findByRole('radio', { name: '800' });
  };
  it('AC-A3-1 : 800 par défaut (valeur du serveur), pastille 800 active', async () => {
    await monterObjectif();
    expect(screen.getByRole('radio', { name: '800' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('radio', { name: '700' }).props.accessibilityState.checked).toBe(false);
  });
  it('AC-A3-2 : la saisie 820 désactive les pastilles et déplace le curseur', async () => {
    await monterObjectif();
    await fireEvent.changeText(screen.getByDisplayValue('800'), '820');
    for (const p of ['600', '700', '800', '900']) expect(screen.getByRole('radio', { name: p }).props.accessibilityState.checked).toBe(false);
    expect(screen.getByRole('adjustable', { name: t.objectif.curseur }).props.accessibilityValue.now).toBe(820);
  });
  it('une pastille fixe la valeur du champ', async () => {
    await monterObjectif();
    await fireEvent.press(screen.getByRole('radio', { name: '900' }));
    expect(screen.getByDisplayValue('900')).toBeTruthy();
  });
  it('AC-A3-3 : 9 et 991 sont refusés, le bouton est désactivé avec un message', async () => {
    await monterObjectif();
    for (const v of ['9', '991']) {
      await fireEvent.changeText(screen.getByDisplayValue(/^\d+$/), v);
      expect(screen.getByText(t.objectif.erreurBornes.replace('{{min}}', '10').replace('{{max}}', '990'))).toBeTruthy();
      expect(screen.getByRole('button', { name: t.continuer }).props.accessibilityState.disabled).toBe(true);
    }
  });
  it('le curseur au clavier d’accessibilité règle la valeur par pas', async () => {
    await monterObjectif();
    await fireEvent(screen.getByRole('adjustable', { name: t.objectif.curseur }), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(screen.getByDisplayValue('810')).toBeTruthy();
  });
  it('continuer enregistre l’objectif (sans date : AC-A3-5) puis ouvre A4', async () => {
    await monterObjectif();
    await fireEvent.changeText(screen.getByDisplayValue('800'), '820');
    await fireEvent.press(screen.getByRole('button', { name: t.continuer }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/certification/temps'));
    expect(await lirePlan()).toMatchObject({ exam: 'toeic', objectif: 820, dateTest: null });
    expect(suivre).toHaveBeenCalledWith('cert_goal_set', { score: 820, date_renseignee: false });
  });
  const continuerActif = () => screen.getByRole('button', { name: t.continuer }).props.accessibilityState.disabled !== true;
  it('TOEIC-A3-DATE-VIDE : champ visible avec son format, facultatif, « Continuer » actif', async () => {
    await monterObjectif();
    expect(screen.getByPlaceholderText(t.objectif.datePlaceholder)).toBeTruthy();
    expect(screen.getByText(t.objectif.dateVide)).toBeTruthy();
    expect(continuerActif()).toBe(true);
  });
  it('TOEIC-A3-DATE-VALIDE : date saisie, jours restants, enregistrée au clavier JJ/MM/AAAA', async () => {
    await monterObjectif();
    const demain = new Date(Date.now() + 42 * 86400000);
    const saisie = `${String(demain.getUTCDate()).padStart(2, '0')}/${String(demain.getUTCMonth() + 1).padStart(2, '0')}/${demain.getUTCFullYear()}`;
    await fireEvent.changeText(screen.getByPlaceholderText(t.objectif.datePlaceholder), saisie);
    expect(screen.getByText(t.objectif.dateValide.replace('{{date}}', saisie).replace('{{n}}', '42'))).toBeTruthy();
    expect(continuerActif()).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: t.continuer }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/certification/temps'));
    expect((await lirePlan())?.dateTest).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(suivre).toHaveBeenCalledWith('cert_goal_set', { score: 800, date_renseignee: true });
  });
  it('TOEIC-A3-DATE-FORMAT : JJ/MM sans année, message texte, « Continuer » désactivé', async () => {
    await monterObjectif();
    await fireEvent.changeText(screen.getByPlaceholderText(t.objectif.datePlaceholder), '26/11');
    expect(screen.getByText(t.objectif.dateFormat)).toBeTruthy();
    expect(continuerActif()).toBe(false);
  });
  it('TOEIC-A3-DATE-PASSEE : date passée refusée avec son message, « Continuer » désactivé', async () => {
    await monterObjectif();
    await fireEvent.changeText(screen.getByPlaceholderText(t.objectif.datePlaceholder), '02/10/2026');
    expect(screen.getByText(t.objectif.datePassee)).toBeTruthy();
    expect(continuerActif()).toBe(false);
    await fireEvent.changeText(screen.getByPlaceholderText(t.objectif.datePlaceholder), '');
    expect(continuerActif()).toBe(true);
  });
  it('TOEIC-A3-MOTIF : date passée, son message reste sous le champ, « Continuer » grisé', async () => {
    await monterObjectif();
    await fireEvent.changeText(screen.getByPlaceholderText(t.objectif.datePlaceholder), '02/02/2026');
    expect(screen.getByText(t.objectif.datePassee)).toBeTruthy();
    expect(continuerActif()).toBe(false);
  });
  it('TOEIC-A3-MOTIF : score vide, le motif indique quoi saisir', async () => {
    await monterObjectif();
    await fireEvent.changeText(screen.getByDisplayValue(/^\d+$/), '');
    expect(screen.getByText(t.objectif.scoreVide)).toBeTruthy();
    expect(continuerActif()).toBe(false);
  });
  it('AC-A3-4 : « Passer » ne crée aucun objectif et continue', async () => {
    await monterObjectif();
    await fireEvent.press(screen.getByRole('button', { name: t.objectif.passer }));
    expect(router.push).toHaveBeenCalledWith('/certification/temps');
    expect(await lirePlan()).toBeNull();
    expect(suivre).toHaveBeenCalledWith('cert_goal_skipped', {});
  });
  it('l’étape annonce « étape 3 sur 4 » avec le nom court de l’examen', async () => {
    await monterObjectif();
    expect(screen.getByText('TOEIC · étape 3 sur 4')).toBeTruthy();
  });
});

describe('A4 · Temps par jour', () => {
  it('AC-A4-1 : 20 minutes est présélectionné et recommandé', async () => {
    await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: false });
    await monter(<TempsParJour />);
    const vingt = await screen.findByRole('radio', { name: /20 minutes/ });
    expect(vingt.props.accessibilityState.checked).toBe(true);
    expect(screen.getByText(t.temps.m20)).toBeTruthy();
    expect(screen.getByText(t.temps.m10)).toBeTruthy();
    expect(screen.getByText(t.temps.m30)).toBeTruthy();
  });
  it('AC-A4-2 : le choix est enregistré dans le plan et ouvre A5', async () => {
    await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: false });
    await monter(<TempsParJour />);
    await fireEvent.press(await screen.findByRole('radio', { name: /30 minutes/ }));
    await fireEvent.press(screen.getByRole('button', { name: t.temps.commencer }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect((await lirePlan())?.minutes).toBe(30);
    expect(suivre).toHaveBeenCalledWith('cert_daily_time_set', { minutes: 30 });
  });
  it('E-06 : « Recommandé » reste sur la ligne 20 même si le défaut servi est 10', async () => {
    definirApi(creerApiFausse({ reglages: { session_minutes_default: 10 } }).api);
    await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: false });
    await monter(<TempsParJour />);
    const dix = await screen.findByRole('radio', { name: /10 minutes/ });
    expect(dix.props.accessibilityState.checked).toBe(true);
    expect(screen.getByText(t.temps.m10)).toBeTruthy();
    expect(screen.getAllByText(t.temps.m20)).toHaveLength(1);
  });
  it('reprend le choix déjà enregistré (relecture dans D4)', async () => {
    await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: false });
    await AsyncStorage.setItem('cert.plan', JSON.stringify({ exam: 'toeic', pays: 'CM', objectif: 800, dateTest: null, minutes: 10 }));
    await monter(<TempsParJour />);
    expect((await screen.findByRole('radio', { name: /10 minutes/ })).props.accessibilityState.checked).toBe(true);
  });
});

describe('A5 · Arrivée avant diagnostic', () => {
  it('AC-A5-1 : aucune valeur de performance, les repères et le contenu du diagnostic', async () => {
    await monter(<ArriveeToeic />);
    // Le compte vient du plan servi (diag_counts), pas du seuil de score : 21 questions, 9 écoute / 12 lecture.
    expect(await screen.findByText(t.arrivee.repereQuestions.replace('{{n}}', '21'))).toBeTruthy();
    expect(screen.getByText(t.arrivee.repereDuree)).toBeTruthy();
    expect(screen.getByText(t.arrivee.repereGratuit)).toBeTruthy();
    expect(screen.getByText(t.arrivee.intro)).toBeTruthy();
    expect(screen.getByText(t.arrivee.contientEcouteTitre)).toBeTruthy();
    expect(screen.getByText(t.arrivee.contientEcouteAide.replace('{{n}}', '9'))).toBeTruthy();
    expect(screen.getByText(t.arrivee.contientLectureTitre)).toBeTruthy();
    expect(screen.getByText(t.arrivee.contientLectureAide.replace('{{n}}', '12'))).toBeTruthy();
    expect(screen.getByText(t.arrivee.donneTexte)).toBeTruthy();
    expect(screen.getByText(t.arrivee.regle)).toBeTruthy();
    expect(screen.queryByText(/\d{3} à \d{3}/)).toBeNull();
  });
  it('AC-A5-2 : une seule action, plus de rangées Cours, Carnet ou Séance', async () => {
    await monter(<ArriveeToeic />);
    await screen.findByText(t.arrivee.badge);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByText(t.arrivee.cours)).toBeNull();
    expect(screen.queryByText(t.arrivee.carnet)).toBeNull();
    expect(screen.queryByText(t.arrivee.seance)).toBeNull();
  });
  it('« Commencer le diagnostic » trace l’évènement puis ouvre A6', async () => {
    await monter(<ArriveeToeic />);
    await act(async () => {
      await attendre();
    });
    await fireEvent.press(screen.getByRole('button', { name: t.arrivee.commencer }));
    expect(suivre).toHaveBeenCalledWith('cert_diagnostic_started', {});
    expect(router.push).toHaveBeenCalledWith('/certification/diagnostic');
  });
});
