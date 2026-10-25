import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { definirApi, type CertApi } from '@/services/certification/api';
import { demarrerOuReprendre, repondre, terminer } from '@/services/certification/diagnostic';
import { lireDiagnostic } from '@/services/certification/etat';
import { marquerTourDiagnosticVu } from '@/services/certification/tourDiagnostic';
import type { Tentative } from '@/services/certification/types';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import { enregistrerProfil, lireProfil } from '@/services/profil';

import { Diagnostic } from '../Diagnostic';
import { FinDiagnostic } from '../FinDiagnostic';
import { ResultatDiagnostic } from '../ResultatDiagnostic';
import { attendre, monter } from './harnais';

const t = fr.certification;

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/services/analytics', () => ({
  suivre: jest.fn(), definirProprietesUtilisateur: jest.fn(),
  drapeauActif: jest.fn(() => true),
  ecouterDrapeaux: jest.fn(() => () => {}),
}));
let mockCompteur = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockCompteur}` }));
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

const entete = (n: number) => t.diagnostic.entete.replace('{{n}}', String(n)).replace('{{total}}', '21');

beforeEach(async () => {
  jest.clearAllMocks();
  mockCompteur = 0;
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: false });
  definirApi(creerApiFausse().api);
});
afterEach(() => definirApi(null));

/** Répond à `n` questions par le service, comme si l'élève avait déjà avancé. */
async function avancerService(n: number, chosen: number | null = 0) {
  let e = await demarrerOuReprendre('toeic');
  for (let i = 0; i < n; i++) e = await repondre(e, chosen, 1000);
  return e;
}

/** Attend le bouton « Commencer la partie N » s'il s'affiche (D-P1, D-P3) : une seule attente courte, sans erreur. */
async function trouverConsigne() {
  try {
    return await screen.findByRole('button', { name: /Commencer la partie/ }, { timeout: 300 });
  } catch {
    return null;
  }
}

/** Passe les consignes affichées avant une partie, comme le ferait l'élève. */
async function passerConsignes() {
  for (let i = 0; i < 8; i++) {
    const bouton = await trouverConsigne();
    if (!bouton) return;
    fireEvent.press(bouton);
  }
}

describe('A6 · Diagnostic', () => {
  it('affiche la première question et une progression « 1 / 21 »', async () => {
    await monter(<Diagnostic />);
    await passerConsignes();
    expect(await screen.findByText(entete(1), { exact: false })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: t.diagnostic.valider }).length).toBeGreaterThan(0);
  });

  it('« Valider » est inactif tant qu’aucune option n’est choisie, puis avance et garde la réponse', async () => {
    await monter(<Diagnostic />);
    await passerConsignes();
    await screen.findByText(entete(1), { exact: false });
    const valider = () => screen.getByRole('button', { name: t.diagnostic.valider });
    expect(valider().props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: /^a/ }));
    expect(valider().props.accessibilityState?.disabled).toBeFalsy();
    await fireEvent.press(valider());
    await passerConsignes();
    expect(await screen.findByText(entete(2), { exact: false })).toBeTruthy();
    const etat = await lireDiagnostic();
    expect(etat?.reponses).toHaveLength(1);
    expect(etat?.reponses[0].chosen).toBe(0);
    expect(suivre).toHaveBeenCalledWith('cert_exercise_answered', expect.objectContaining({ juste: null }));
  });

  it('« Passer cette question » enregistre une réponse vide qui compte comme fausse', async () => {
    await monter(<Diagnostic />);
    await passerConsignes();
    await screen.findByText(entete(1), { exact: false });
    await fireEvent.press(screen.getByRole('button', { name: t.diagnostic.passer }));
    await passerConsignes();
    expect(await screen.findByText(entete(2), { exact: false })).toBeTruthy();
    expect((await lireDiagnostic())?.reponses[0].chosen).toBeNull();
  });

  it('reprend à la question suivante après un redémarrage', async () => {
    await avancerService(5);
    await monter(<Diagnostic />);
    await passerConsignes();
    expect(await screen.findByText(entete(6), { exact: false })).toBeTruthy();
  });

  it('la dernière réponse ouvre A8', async () => {
    // Il reste le dernier groupe de partie 7 (questions 20 et 21) : les deux se passent, le groupe part, A8 s'ouvre.
    await avancerService(19);
    await monter(<Diagnostic />);
    await passerConsignes();
    await screen.findByText(entete(20), { exact: false });
    await fireEvent.press(screen.getByRole('button', { name: t.diagnostic.passer }));
    await fireEvent.press(screen.getByRole('button', { name: t.diagnostic.passer }));
    await passerConsignes();
    await attendre();
    expect(router.replace).toHaveBeenCalledWith('/certification/fin');
  });

  it('audio indisponible : l’état s’affiche, le texte reste lisible, on peut passer', async () => {
    await monter(<Diagnostic />);
    await passerConsignes();
    await screen.findByText(entete(1), { exact: false });
    await fireEvent.press(screen.getByRole('button', { name: t.exercice.ecouter }));
    expect(await screen.findByText(t.exercice.audioKoTitre)).toBeTruthy();
    expect(screen.getByText(t.exercice.audioKoAide)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t.exercice.audioKoPasser }));
    await passerConsignes();
    expect(await screen.findByText(entete(2), { exact: false })).toBeTruthy();
  });

  it('retour sans réponse : revient en arrière ; avec réponses : propose de quitter en gardant les réponses', async () => {
    await monter(<Diagnostic />);
    await passerConsignes();
    await screen.findByText(entete(1), { exact: false });
    await fireEvent.press(screen.getByRole('button', { name: t.retour }));
    expect(router.back).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: t.diagnostic.passer }));
    await passerConsignes();
    await screen.findByText(entete(2), { exact: false });
    await fireEvent.press(screen.getByRole('button', { name: t.retour }));
    expect(router.back).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: t.quitter.quitter }));
    expect(router.replace).toHaveBeenCalledWith('/certification/arrivee');
    expect((await lireDiagnostic())?.reponses).toHaveLength(1);
  });

  it('démarrage impossible : message d’erreur et « Réessayer » relance', async () => {
    const { api } = creerApiFausse({ echecDemarrer: true });
    definirApi(api);
    await monter(<Diagnostic />);
    // Un nouvel essai silencieux précède l'erreur : on laisse le temps de le voir échouer.
    expect(await screen.findByText(t.diagnostic.erreurGardees, undefined, { timeout: 4000 })).toBeTruthy();
    definirApi(creerApiFausse().api);
    await fireEvent.press(screen.getByRole('button', { name: t.reessayer }));
    await passerConsignes();
    expect(await screen.findByText(entete(1), { exact: false })).toBeTruthy();
  });

  it('aucune question publiée côté serveur : message « pas encore disponible », sans « Réessayer » ni erreur réseau', async () => {
    const api = creerApiFausse().api;
    definirApi({ ...api, demarrerDiagnostic: async () => { throw new Error('contenu indisponible'); } });
    await monter(<Diagnostic />);
    expect(await screen.findByText(t.diagnostic.videTitre)).toBeTruthy();
    expect(screen.getByText(t.diagnostic.videTexte)).toBeTruthy();
    expect(screen.queryByRole('button', { name: t.reessayer })).toBeNull();
    expect(screen.queryByText(t.diagnostic.erreurTitre)).toBeNull();
  });

  it.each(['clair', 'sombre'] as const)('se monte en thème %s', async (reglage) => {
    await monter(<Diagnostic />, reglage);
    await passerConsignes();
    expect(await screen.findByText(entete(1), { exact: false })).toBeTruthy();
  });
});

describe('A6 · Diagnostic : validation par groupe (partie 6, texte à trous entier)', () => {
  /** Fond d'un tag de trou, lu dans ses styles en ligne. */
  const fondTag = (n: number) => {
    const style = screen.getByLabelText(t.exercice.trou.replace('{{n}}', String(n))).props.style as unknown[];
    const entree = style.find((s) => typeof s === 'object' && s !== null && 'backgroundColor' in (s as Record<string, unknown>)) as { backgroundColor: string };
    return entree.backgroundColor;
  };

  it('onglets du groupe, trous numérotés dans le texte, « Valider (n/4) », bannière et « Valider quand même »', async () => {
    // 12 réponses déjà données : l'écran reprend sur le groupe de partie 6 (questions 13 à 16, un seul texte).
    await avancerService(12);
    await monter(<Diagnostic />);
    await passerConsignes();
    expect(await screen.findByText(entete(13), { exact: false })).toBeTruthy();

    // Un onglet par question du groupe, aux numéros officiels.
    for (const n of [13, 14, 15, 16]) {
      expect(screen.getByRole('tab', { name: t.exercice.question.replace('{{n}}', String(n)) })).toBeTruthy();
    }
    // Chaque trou du texte porte le numéro de sa question ; le trou en cours est en jaune, les autres pas encore.
    for (const n of [13, 14, 15, 16]) {
      expect(screen.getByLabelText(t.exercice.trou.replace('{{n}}', String(n)))).toBeTruthy();
    }
    expect(fondTag(13)).toBe('#FFD83D');
    expect(fondTag(14)).not.toBe('#FFD83D');

    // Rien de répondu dans le groupe : « Valider (0/4) » inactif.
    const valider = (nom: string) => screen.getByRole('button', { name: nom });
    expect(valider(t.exercice.validerN.replace('{{n}}', '0').replace('{{total}}', '4')).props.accessibilityState?.disabled).toBe(true);

    // Une réponse : l'onglet suivant devient courant, son trou passe en jaune, le trou répondu en vert, « Valider (1/4) ».
    await fireEvent.press(screen.getByRole('button', { name: /^a/ }));
    expect(fondTag(13)).not.toBe('#FFD83D');
    expect(fondTag(14)).toBe('#FFD83D');
    expect(valider(t.exercice.validerN.replace('{{n}}', '1').replace('{{total}}', '4')).props.accessibilityState?.disabled).toBeFalsy();

    // Groupe incomplet : premier appui = bannière + « Valider quand même », second appui = envoi du groupe entier.
    await fireEvent.press(valider(t.exercice.validerN.replace('{{n}}', '1').replace('{{total}}', '4')));
    expect(await screen.findByText(t.exercice.pasToutRepondu)).toBeTruthy();
    await fireEvent.press(valider(t.exercice.validerQuandMeme.replace('{{n}}', '1').replace('{{total}}', '4')));
    await passerConsignes();
    expect(await screen.findByText(entete(17), { exact: false })).toBeTruthy();
    expect((await lireDiagnostic())?.reponses).toHaveLength(16);
  });
});

describe('A6 · Tour de première fois du diagnostic (#123)', () => {
  /** Monte le diagnostic et avance, au « Passer », jusqu'au premier groupe audio (partie 3, questions 4 à 6). */
  async function allerAuPremierGroupeAudio() {
    await monter(<Diagnostic />);
    await passerConsignes();
    expect(await screen.findByText(entete(1), { exact: false })).toBeTruthy();
    // Questions seules (parties 1 et 2) : aucune feuille ne se présente.
    expect(screen.queryByText(t.tour.audio.titre)).toBeNull();
    expect(screen.queryByText(t.tour.partie7.titre)).toBeNull();
    for (let i = 0; i < 3; i++) {
      await fireEvent.press(screen.getByRole('button', { name: t.diagnostic.passer }));
      await passerConsignes();
    }
    expect(await screen.findByText(entete(4), { exact: false })).toBeTruthy();
  }

  /** API fausse dont les groupes de partie 7 portent le nombre de documents demandé (1 = texte à plat, 2 = `docs`). */
  function apiPartie7(documentsParGroupe: number[]): CertApi {
    const base = creerApiFausse();
    const rangs = new Map<string, number>();
    const questions = base.questions.map((q) => {
      if (q.part !== 7 || !q.group) return q;
      if (!rangs.has(q.group.id)) rangs.set(q.group.id, rangs.size);
      const nb = documentsParGroupe[rangs.get(q.group.id) ?? 0] ?? 1;
      if (nb <= 1) return q;
      const passage = { docs: [1, 2].map((i) => ({ kind: 'Document', head: `Document ${i}`, text: `Contenu du document ${i}.` })), multi: true };
      return { ...q, group: { ...q.group, passage } };
    });
    return {
      ...base.api,
      demarrerDiagnostic: async (clientUuid: string) => {
        const tentative: Tentative = { attempt_id: `att-${clientUuid}`, kind: 'diagnostic', part: null, length: questions.length, status: 'in_progress', started_at: '2026-10-15T10:00:00Z', credits_spent: 0, questions, replay: false };
        return tentative;
      },
    };
  }

  it('la feuille « audio » s’ouvre au premier groupe audio ; « C’est parti » la ferme et pose le drapeau', async () => {
    await allerAuPremierGroupeAudio();
    expect(await screen.findByText(t.tour.audio.titre)).toBeTruthy();
    expect(screen.getByText(t.tour.audio.reponseTitre)).toBeTruthy();
    expect(screen.getByText(t.tour.audio.avanceTitre)).toBeTruthy();
    expect(screen.getByText(t.tour.audio.retourTitre)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t.tour.bouton }));
    await attendre();
    expect(screen.queryByText(t.tour.audio.titre)).toBeNull();
    expect(await AsyncStorage.getItem('cert.tourDiagnostic.audio.vue')).toBe('1');
    expect(await AsyncStorage.getItem('cert.tourDiagnostic.partie7.vue')).toBeNull();
  });

  it('drapeau audio déjà posé : aucune feuille au premier groupe audio', async () => {
    await marquerTourDiagnosticVu('audio');
    await allerAuPremierGroupeAudio();
    await attendre(150);
    expect(screen.queryByText(t.tour.audio.titre)).toBeNull();
  });

  it('pas de seconde feuille au deuxième groupe audio (partie 4)', async () => {
    await allerAuPremierGroupeAudio();
    expect(await screen.findByText(t.tour.audio.titre)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t.tour.bouton }));
    // Le groupe se répond question par question (avancement automatique), puis se valide entier.
    for (let i = 0; i < 3; i++) await fireEvent.press(screen.getByRole('button', { name: /^a/ }));
    await fireEvent.press(screen.getByRole('button', { name: t.exercice.validerN.replace('{{n}}', '3').replace('{{total}}', '3') }));
    await passerConsignes();
    expect(await screen.findByText(entete(7), { exact: false })).toBeTruthy();
    await attendre(150);
    expect(screen.queryByText(t.tour.audio.titre)).toBeNull();
  });

  it('aucune feuille sur le groupe de partie 6 (texte à trous, sans audio ni documents)', async () => {
    await avancerService(12);
    await monter(<Diagnostic />);
    await passerConsignes();
    expect(await screen.findByText(entete(13), { exact: false })).toBeTruthy();
    await attendre(150);
    expect(screen.queryByText(t.tour.audio.titre)).toBeNull();
    expect(screen.queryByText(t.tour.partie7.titre)).toBeNull();
  });

  it('la feuille « partie 7 » s’ouvre au premier groupe multi-documents et pose son propre drapeau', async () => {
    definirApi(apiPartie7([2, 2]));
    await avancerService(16);
    await monter(<Diagnostic />);
    await passerConsignes();
    expect(await screen.findByText(t.tour.partie7.titre)).toBeTruthy();
    expect(screen.getByText(t.tour.partie7.questionsTitre)).toBeTruthy();
    expect(screen.getByText(t.tour.partie7.documentsTitre)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t.tour.bouton }));
    await attendre();
    expect(screen.queryByText(t.tour.partie7.titre)).toBeNull();
    expect(await AsyncStorage.getItem('cert.tourDiagnostic.partie7.vue')).toBe('1');
    expect(await AsyncStorage.getItem('cert.tourDiagnostic.audio.vue')).toBeNull();
  });

  it('groupe de partie 7 à document unique : la feuille attend le groupe multi-documents suivant', async () => {
    definirApi(apiPartie7([1, 2]));
    await avancerService(16);
    await monter(<Diagnostic />);
    await passerConsignes();
    expect(await screen.findByText(entete(17), { exact: false })).toBeTruthy();
    await attendre(150);
    expect(screen.queryByText(t.tour.partie7.titre)).toBeNull();
    // Le premier groupe (2 questions) se passe ; le second, multi-documents, ouvre la feuille.
    await fireEvent.press(screen.getByRole('button', { name: t.diagnostic.passer }));
    await fireEvent.press(screen.getByRole('button', { name: t.diagnostic.passer }));
    expect(await screen.findByText(t.tour.partie7.titre)).toBeTruthy();
    expect(await AsyncStorage.getItem('cert.tourDiagnostic.partie7.vue')).toBeNull();
  });
});

describe('A8 · Fin du diagnostic', () => {
  it('sans diagnostic terminé, renvoie vers A6', async () => {
    await monter(<FinDiagnostic />);
    await attendre();
    expect(router.replace).toHaveBeenCalledWith('/certification/diagnostic');
  });

  it('calcule le résultat en arrière-plan puis « Voir mon résultat » ouvre A7', async () => {
    await avancerService(21);
    await monter(<FinDiagnostic />);
    expect(await screen.findByText(t.diagnostic.termineTitre)).toBeTruthy();
    await attendre();
    await fireEvent.press(screen.getByRole('button', { name: t.diagnostic.voirResultat }));
    await attendre();
    expect(router.replace).toHaveBeenCalledWith('/certification/resultat');
    expect((await lireDiagnostic())?.fin).not.toBeNull();
  });

  it('échec réseau : bannière, puis « Voir mon résultat » rejoue l’envoi', async () => {
    const { api, appels } = creerApiFausse({ echecsTerminer: 1 });
    definirApi(api);
    await avancerService(21);
    await monter(<FinDiagnostic />);
    expect(await screen.findByText(t.diagnostic.envoiEchec)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t.diagnostic.voirResultat }));
    await attendre();
    expect(appels.terminer).toBe(2);
    expect(router.replace).toHaveBeenCalledWith('/certification/resultat');
  });
});

describe('A7 · Résultat du diagnostic', () => {
  async function preparer(mots = { total: 0, theme: null as string | null }) {
    const { api } = creerApiFausse({ mots });
    definirApi(api);
    // Les réponses sont toutes fausses (option 1) : toutes les parties sont à travailler.
    const e = await avancerService(21, 1);
    await terminer(e);
  }

  it('sans résultat calculé, renvoie vers A8', async () => {
    await monter(<ResultatDiagnostic />);
    await attendre();
    expect(router.replace).toHaveBeenCalledWith('/certification/fin');
  });

  it('montre un score estimé d’un seul chiffre, une estimation non officielle, la maîtrise et au plus trois points faibles', async () => {
    await preparer({ total: 12, theme: 'bureau' });
    await monter(<ResultatDiagnostic />);
    expect(await screen.findByText('700')).toBeTruthy();
    expect(screen.queryByText('650 à 730', { exact: false })).toBeNull();
    expect(screen.getByText(t.resultat.estimation)).toBeTruthy();
    expect(screen.getByText(t.resultat.maitrise)).toBeTruthy();
    for (const g of Object.values(t.resultat.groupes)) expect(screen.getByText(g)).toBeTruthy();
    expect(screen.getByText(t.resultat.motsDuBureau)).toBeTruthy();
    expect(screen.getByText(t.resultat.aTravailler.replace('{{n}}', '3'))).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('cert_diagnostic_completed', { score_min: 650, score_max: 730 });
  });

  it('« Revoir mes réponses » ouvre la revue question par question du diagnostic', async () => {
    await preparer();
    await monter(<ResultatDiagnostic />);
    await screen.findByText(t.resultat.maitrise);
    await fireEvent.press(screen.getByRole('button', { name: t.bilanMini.revoir }));
    expect(router.push).toHaveBeenCalledWith('/certification/diagnostic-revue');
  });

  it('« Voir mon plan » termine le profil et ouvre l’accueil', async () => {
    await preparer();
    await monter(<ResultatDiagnostic />);
    await screen.findByText(t.resultat.maitrise);
    await fireEvent.press(screen.getByRole('button', { name: t.resultat.voirPlan }));
    await attendre();
    expect((await lireProfil())?.termine).toBe(true);
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it.each(['clair', 'sombre'] as const)('se monte en thème %s', async (reglage) => {
    await preparer();
    await monter(<ResultatDiagnostic />, reglage);
    expect(await screen.findByText(t.resultat.maitrise)).toBeTruthy();
  });
});

describe('A6 · Diagnostic : consignes avant chaque partie (D-P1, D-P3)', () => {
  it('affiche les consignes de la partie 1 avant la première question, puis la question', async () => {
    creerApiFausse();
    definirApi(creerApiFausse().api);
    await monter(<Diagnostic />);
    expect(await screen.findByText(fr.certification.consignes.partie1.titre)).toBeTruthy();
    expect(screen.queryByText(entete(1), { exact: false })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: fr.certification.consignes.commencer.replace('{{n}}', '1') }));
    expect(await screen.findByText(entete(1), { exact: false })).toBeTruthy();
  });
});
