import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { definirApi } from '@/services/certification/api';
import { demarrerOuReprendre, repondre, terminer } from '@/services/certification/diagnostic';
import { lireDiagnostic } from '@/services/certification/etat';
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

const entete = (n: number) => t.diagnostic.entete.replace('{{n}}', String(n)).replace('{{total}}', '20');

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

describe('A6 · Diagnostic', () => {
  it('affiche la première question et une progression « 1 / 20 »', async () => {
    await monter(<Diagnostic />);
    expect(await screen.findByText(entete(1), { exact: false })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: t.diagnostic.valider }).length).toBeGreaterThan(0);
  });

  it('« Valider » est inactif tant qu’aucune option n’est choisie, puis avance et garde la réponse', async () => {
    await monter(<Diagnostic />);
    await screen.findByText(entete(1), { exact: false });
    const valider = () => screen.getByRole('button', { name: t.diagnostic.valider });
    expect(valider().props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: /^a/ }));
    expect(valider().props.accessibilityState?.disabled).toBeFalsy();
    await fireEvent.press(valider());
    expect(await screen.findByText(entete(2), { exact: false })).toBeTruthy();
    const etat = await lireDiagnostic();
    expect(etat?.reponses).toHaveLength(1);
    expect(etat?.reponses[0].chosen).toBe(0);
    expect(suivre).toHaveBeenCalledWith('cert_exercise_answered', expect.objectContaining({ juste: null }));
  });

  it('« Passer cette question » enregistre une réponse vide qui compte comme fausse', async () => {
    await monter(<Diagnostic />);
    await screen.findByText(entete(1), { exact: false });
    await fireEvent.press(screen.getByRole('button', { name: t.diagnostic.passer }));
    expect(await screen.findByText(entete(2), { exact: false })).toBeTruthy();
    expect((await lireDiagnostic())?.reponses[0].chosen).toBeNull();
  });

  it('reprend à la question suivante après un redémarrage', async () => {
    await avancerService(5);
    await monter(<Diagnostic />);
    expect(await screen.findByText(entete(6), { exact: false })).toBeTruthy();
  });

  it('la dernière réponse ouvre A8', async () => {
    await avancerService(19);
    await monter(<Diagnostic />);
    await screen.findByText(entete(20), { exact: false });
    await fireEvent.press(screen.getByRole('button', { name: t.diagnostic.passer }));
    await attendre();
    expect(router.replace).toHaveBeenCalledWith('/certification/fin');
  });

  it('audio indisponible : l’état s’affiche, le texte reste lisible, on peut passer', async () => {
    await monter(<Diagnostic />);
    await screen.findByText(entete(1), { exact: false });
    await fireEvent.press(screen.getByRole('button', { name: t.exercice.ecouter }));
    expect(await screen.findByText(t.exercice.audioKoTitre)).toBeTruthy();
    expect(screen.getByText(t.exercice.audioKoAide)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: t.exercice.audioKoPasser }));
    expect(await screen.findByText(entete(2), { exact: false })).toBeTruthy();
  });

  it('retour sans réponse : revient en arrière ; avec réponses : propose de quitter en gardant les réponses', async () => {
    await monter(<Diagnostic />);
    await screen.findByText(entete(1), { exact: false });
    await fireEvent.press(screen.getByRole('button', { name: t.retour }));
    expect(router.back).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: t.diagnostic.passer }));
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
    expect(await screen.findByText(entete(1), { exact: false })).toBeTruthy();
  });
});

describe('A8 · Fin du diagnostic', () => {
  it('sans diagnostic terminé, renvoie vers A6', async () => {
    await monter(<FinDiagnostic />);
    await attendre();
    expect(router.replace).toHaveBeenCalledWith('/certification/diagnostic');
  });

  it('calcule le résultat en arrière-plan puis « Voir mon résultat » ouvre A7', async () => {
    await avancerService(20);
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
    await avancerService(20);
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
    const e = await avancerService(20, 1);
    await terminer(e);
  }

  it('sans résultat calculé, renvoie vers A8', async () => {
    await monter(<ResultatDiagnostic />);
    await attendre();
    expect(router.replace).toHaveBeenCalledWith('/certification/fin');
  });

  it('montre la fourchette, une estimation non officielle, la maîtrise et au plus trois points faibles', async () => {
    await preparer({ total: 12, theme: 'bureau' });
    await monter(<ResultatDiagnostic />);
    expect(await screen.findByText('650 à 730', { exact: false })).toBeTruthy();
    expect(screen.getByText(t.resultat.estimation)).toBeTruthy();
    expect(screen.getByText(t.resultat.maitrise)).toBeTruthy();
    for (const g of Object.values(t.resultat.groupes)) expect(screen.getByText(g)).toBeTruthy();
    expect(screen.getByText(t.resultat.motsDuBureau)).toBeTruthy();
    expect(screen.getByText(t.resultat.aTravailler.replace('{{n}}', '3'))).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('cert_diagnostic_completed', { score_min: 650, score_max: 730 });
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
