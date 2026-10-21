import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { definirDernierContactPourTest } from '@/services/connectivite';
import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import { FICHE_TEST, JOUR, MOTS_TEST, REVISION_TEST } from '@/services/certification/__tests__/fixturesRevision';
import { enregistrerProfil } from '@/services/profil';

import { CarteMaitrise } from '../CarteMaitrise';
import { FicheMot } from '../FicheMot';
import { FicheNotion } from '../FicheNotion';
import { FinSeanceMots } from '../FinSeanceMots';
import { NotionsPartie } from '../NotionsPartie';
import { ReviserToeic } from '../ReviserToeic';
import { SeanceMots } from '../SeanceMots';
import { monter } from './harnais';

const t = fr.certification;

let mockParams: Record<string, string> = {};
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
  fausse = creerApiFausse({ revision: REVISION_TEST, carnet: MOTS_TEST, fiche: FICHE_TEST, ...options });
  definirApi(fausse.api);
};
const HORS_LIGNE = { doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'clearTimeout', 'clearInterval', 'nextTick', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame'] as ('setTimeout' | 'setInterval' | 'setImmediate' | 'clearTimeout' | 'clearInterval' | 'nextTick' | 'queueMicrotask' | 'requestAnimationFrame' | 'cancelAnimationFrame')[] };

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(`${JOUR}T10:00:00`), ...HORS_LIGNE });
  jest.clearAllMocks();
  mockCompteur = 0;
  mockParams = {};
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: true });
  installer();
});
afterEach(() => {
  definirDernierContactPourTest(null);
  definirApi(null);
  jest.useRealTimers();
});

describe('C2 · Carte de maîtrise', () => {
  it('liste les sept parties avec leur pourcentage et leur état, et les totaux par notion', async () => {
    await monter(<CarteMaitrise />);
    expect(await screen.findByText('Partie 5')).toBeTruthy();
    expect(screen.getByText('25 %')).toBeTruthy();
    expect(screen.getAllByText(t.resultat.etats.fragile).length).toBeGreaterThan(0);
    expect(screen.getByText(fr.certification.carteMaitrise.acquise.replace('{{n}}', '1'))).toBeTruthy();
    expect(screen.getByText(fr.certification.carteMaitrise.fragile.replace('{{n}}', '1'))).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('cert_mastery_viewed', { ecran: 'carte' });
  });

  it('propose la partie la plus faible parmi celles qui ont des réponses', async () => {
    await monter(<CarteMaitrise />);
    await fireEvent.press(await screen.findByText(t.carteMaitrise.voir.replace('{{n}}', '5')));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/partie', params: { n: '5' } });
  });

  it('S7 : affiche l’état vide tant qu’aucune partie n’a de réponse', async () => {
    installer({ revision: { notions: REVISION_TEST.notions, parties: REVISION_TEST.parties.map((p) => ({ ...p, reponses: 0, m: 0, etat: 'pas_commencee' as const })) } });
    await monter(<CarteMaitrise />);
    expect(await screen.findByText(new RegExp(t.carteMaitrise.videTitre))).toBeTruthy();
    expect(screen.queryByText(new RegExp(t.carteMaitrise.voir.replace('{{n}}', '\\d')))).toBeNull();
  });

  it('propose de réessayer quand le serveur échoue sans copie', async () => {
    installer({ revision: 'echec' });
    await monter(<CarteMaitrise />);
    expect(await screen.findByText(t.reviser.erreurTitre)).toBeTruthy();
    expect(screen.getByText(t.reessayer)).toBeTruthy();
  });

  it('s’affiche aussi en thème sombre', async () => {
    await monter(<CarteMaitrise />, 'sombre');
    expect(await screen.findByText('Partie 1')).toBeTruthy();
  });
});

describe('C3 · Notions d’une partie', () => {
  beforeEach(() => {
    mockParams = { n: '5' };
  });

  it('trie de la plus fragile à la plus solide et cible la plus fragile par défaut', async () => {
    await monter(<NotionsPartie />);
    const lignes = await screen.findAllByRole('radio');
    expect(lignes[0].props.accessibilityState).toEqual({ checked: true });
    expect(lignes[1].props.accessibilityState).toEqual({ checked: false });
    expect(screen.getByText(t.notionsPartie.entrainer.replace('{{notion}}', 'Forme du mot'))).toBeTruthy();
  });

  it('appuyer sur une carte ouvre la fiche de cette notion', async () => {
    await monter(<NotionsPartie />);
    await fireEvent.press(await screen.findByText('Temps du passé'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/notion/[id]', params: { id: 'n-passe', source: 'partie' } });
  });

  it('lance la série de la notion choisie par défaut', async () => {
    await monter(<NotionsPartie />);
    await fireEvent.press(await screen.findByText(t.notionsPartie.entrainer.replace('{{notion}}', 'Forme du mot')));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/serie', params: { notion: 'n-forme' } });
  });

  it('ouvre la fiche de la notion choisie', async () => {
    await monter(<NotionsPartie />);
    await fireEvent.press(await screen.findByText(t.notionsPartie.revoir));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/notion/[id]', params: { id: 'n-forme', source: 'partie' } });
  });

  it('affiche les décomptes bruts et « 0 question faite » pour une notion pas commencée', async () => {
    await monter(<NotionsPartie />);
    await screen.findByText('Forme du mot');
    expect(screen.getByText(t.notionsPartie.ligne.replace('{{n}}', '6').replace('{{r}}', '2'))).toBeTruthy();
  });

  it('0 question faite pour une notion pas commencée', async () => {
    mockParams = { n: '6' };
    await monter(<NotionsPartie />);
    expect(await screen.findByText(t.notionsPartie.zero)).toBeTruthy();
  });

  it('indique quand la partie n’a aucune notion', async () => {
    mockParams = { n: '3' };
    await monter(<NotionsPartie />);
    expect(await screen.findByText(t.notionsPartie.vide)).toBeTruthy();
  });
});

describe('C5 · Fiche d’une notion', () => {
  beforeEach(() => {
    mockParams = { id: 'n-prepo', source: 'liste' };
  });

  it('rend règle, exemples avec mot en valeur, piège et faux ami, et trace l’ouverture', async () => {
    await monter(<FicheNotion />);
    expect(await screen.findByText(t.fiche.regle)).toBeTruthy();
    expect(screen.getByText(t.fiche.exemples)).toBeTruthy();
    expect(screen.getByText('Nous nous voyons lundi.')).toBeTruthy();
    expect(screen.getByText(t.fiche.piege)).toBeTruthy();
    expect(screen.getByText(t.fiche.fauxAmi.replace('{{texte}}', 'actually ≠ actuellement'))).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('cert_notion_opened', { notion: 'prepo', source: 'liste' });
    await waitFor(() => expect(fausse.appels.notionsOuvertes[0]).toEqual({ id: 'n-prepo', secondes: 0 }));
  });

  it('lance l’entraînement de la notion, et les trois ancrages en mode ancrage', async () => {
    await monter(<FicheNotion />);
    await fireEvent.press(await screen.findByText(t.fiche.entrainer));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/serie', params: { notion: FICHE_TEST.id } });
    await fireEvent.press(screen.getByText(t.fiche.ancrageLigneSans.replace('{{n}}', '1')));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/certification/serie', params: { notion: FICHE_TEST.id, ancrage: '1' } });
  });

  it('propose de réessayer en cas d’erreur', async () => {
    installer({ fiche: 'echec' });
    await monter(<FicheNotion />);
    expect(await screen.findByText(t.fiche.erreurTitre)).toBeTruthy();
  });

  it('S9 : une copie de plus de 7 jours n’est pas servie et n’offre que « Actualiser »', async () => {
    await monter(<FicheNotion />);
    await screen.findByText(t.fiche.regle);
    // Le serveur tombe et le dernier contact remonte à 8 jours (la validité se compte depuis le dernier contact, AGENTS.md §16 bis).
    installer({ fiche: 'echec' });
    definirDernierContactPourTest(Date.now() - 8 * 24 * 3600 * 1000);
    await monter(<FicheNotion />);
    expect(await screen.findByText(t.fiche.expireTitre)).toBeTruthy();
    expect(screen.getByText(t.fiche.actualiser)).toBeTruthy();
    expect(screen.queryByText(t.fiche.relire)).toBeNull();
    expect(screen.queryByText(t.fiche.entrainer)).toBeNull();
  });
});

describe('C6 · Carnet de mots (dans Réviser)', () => {
  beforeEach(() => {
    mockParams = { onglet: 'carnet' };
  });

  it('affiche les compteurs et la liste À revoir, puis filtre par recherche sans accents', async () => {
    await monter(<ReviserToeic />);
    expect(await screen.findByText('postpone')).toBeTruthy();
    expect(screen.getByText(t.carnet.onglets.a_revoir.replace('{{n}}', '2'))).toBeTruthy();
    expect(screen.queryByText('deadline')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText(t.carnet.rechercher), 'DÉADLINE');
    expect(await screen.findByText('deadline')).toBeTruthy();
    expect(screen.queryByText('postpone')).toBeNull();
  });

  it('S6 : aucun résultat propose d’ajouter le mot, qui annonce que l’ajout arrive bientôt', async () => {
    await monter(<ReviserToeic />);
    await screen.findByText('postpone');
    await fireEvent.changeText(screen.getByLabelText(t.carnet.rechercher), 'zzz');
    expect(await screen.findByText(t.carnet.aucunTitre)).toBeTruthy();
    await fireEvent.press(screen.getByText(t.carnet.ajouterMot.replace('{{mot}}', 'zzz')));
    expect(await screen.findByText(t.carnet.ajoutBientot)).toBeTruthy();
  });

  it('S5 : carnet vide', async () => {
    installer({ carnet: [] });
    await monter(<ReviserToeic />);
    expect(await screen.findByText(t.carnet.videTitre)).toBeTruthy();
  });

  it('ouvre la fiche d’un mot', async () => {
    await monter(<ReviserToeic />);
    await fireEvent.press(await screen.findByText('postpone'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/mot/[id]', params: { id: 'w-postpone' } });
  });
});

describe('C4 · Cours (dans Réviser)', () => {
  it('groupe par famille, masque les notions sans fiche et ouvre la fiche', async () => {
    mockParams = { onglet: 'cours' };
    await monter(<ReviserToeic />);
    expect(await screen.findByText('Forme du mot')).toBeTruthy();
    expect(screen.queryByText('Notion sans fiche')).toBeNull();
    await fireEvent.press(screen.getByText(t.cours.familles.piege));
    await fireEvent.press(await screen.findByText('Connecteurs'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/notion/[id]', params: { id: 'n-conn', source: 'liste' } });
  });
});

describe('N3 · Réviser, Parcours', () => {
  it('ouvre la séance du jour, la carte de maîtrise et passe au carnet', async () => {
    await monter(<ReviserToeic />);
    await fireEvent.press(await screen.findByLabelText(new RegExp(t.reviser.parcoursTitre)));
    expect(router.push).toHaveBeenCalledWith('/certification/seance');
    await fireEvent.press(screen.getByText(t.reviser.partiesTitre));
    expect(router.push).toHaveBeenCalledWith('/certification/carte');
  });
});

describe('C7 · Fiche d’un mot', () => {
  it('montre définition, exemple et boîte, et lance la séance de mots quand un mot est échu', async () => {
    mockParams = { id: 'w-postpone' };
    await monter(<FicheMot />);
    expect(await screen.findByText('reporter, remettre à plus tard')).toBeTruthy();
    expect(screen.getByText('They decided to postpone the meeting.')).toBeTruthy();
    expect(screen.getByText(t.mot.boiteEtat.replace('{{n}}', '1').replace('{{etat}}', t.carnet.etats.a_revoir))).toBeTruthy();
    await fireEvent.press(screen.getByText(t.mot.commencer));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/mots-seance', params: { origine: 'carnet' } });
  });

  it('mot introuvable', async () => {
    mockParams = { id: 'w-inconnu' };
    await monter(<FicheMot />);
    expect(await screen.findByText(t.mot.introuvable)).toBeTruthy();
  });
});

describe('C8 et C9 · Séance de mots', () => {
  beforeEach(() => {
    mockParams = { origine: 'carnet' };
  });

  const noterTout = async (reponses: ('su' | 'nonSu')[]) => {
    for (const r of reponses) {
      await fireEvent.press(await screen.findByLabelText(new RegExp(t.seanceMots.touche)));
      await fireEvent.press(screen.getByText(t.seanceMots[r]));
    }
  };

  it('ne note qu’après le retournement de la carte', async () => {
    await monter(<SeanceMots />);
    await screen.findByLabelText(new RegExp(t.seanceMots.touche));
    expect(screen.getByText(t.seanceMots.su)).toBeDisabled();
    expect(fausse.appels.resultatsMots).toHaveLength(0);
  });

  it('enchaîne les cartes échues, trace la boîte avant et après, puis ouvre la fin', async () => {
    await monter(<SeanceMots />);
    await noterTout(['nonSu', 'su']);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/certification/mots-fin'));
    expect(fausse.appels.resultatsMots.flat().map((r) => r.connu)).toEqual([false, true]);
    expect(suivre).toHaveBeenCalledWith('cert_word_state_changed', { mot: 'w-postpone', boite_avant: 1, boite_apres: 1 });
    expect(suivre).toHaveBeenCalledWith('cert_word_state_changed', { mot: 'w-deadline', boite_avant: 2, boite_apres: 3 });
  });

  it('garde les notes sur l’appareil hors ligne et l’annonce', async () => {
    installer({ echecsMots: 5 });
    await monter(<SeanceMots />);
    await fireEvent.press(await screen.findByLabelText(new RegExp(t.seanceMots.touche)));
    await fireEvent.press(screen.getByText(t.seanceMots.nonSu));
    expect(await screen.findByText(t.seanceMots.attente)).toBeTruthy();
  });

  it('S : aucun mot échu', async () => {
    installer({ carnet: [] });
    await monter(<SeanceMots />);
    expect(await screen.findByText(new RegExp(t.seanceMots.aucunTitre))).toBeTruthy();
  });

  it('X3 : la croix ouvre la feuille « Quitter », qui garde les notes', async () => {
    await monter(<SeanceMots />);
    await screen.findByLabelText(new RegExp(t.seanceMots.touche));
    await fireEvent.press(screen.getByLabelText(t.seanceMots.quitterTitre));
    await fireEvent.press(await screen.findByText(t.seanceMots.quitterQuitter));
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/reviser', params: { onglet: 'carnet' } });
  });

  it('C9 : résume la séance (score, mots de demain, boîtes) et revient au carnet', async () => {
    await monter(<SeanceMots />);
    await noterTout(['nonSu', 'su']);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/certification/mots-fin'));
    await monter(<FinSeanceMots />);
    expect(await screen.findByText(t.finMots.scoreUn.replace('{{k}}', '1').replace('{{n}}', '2'))).toBeTruthy();
    expect(screen.getByText(t.finMots.demainUn)).toBeTruthy();
    await fireEvent.press(screen.getByText(t.finMots.retour));
    await waitFor(() => expect(router.replace).toHaveBeenLastCalledWith({ pathname: '/reviser', params: { onglet: 'carnet' } }));
  });

  it('C9 sans séance terminée renvoie vers Réviser', async () => {
    await monter(<FinSeanceMots />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/reviser'));
  });
});
