import AsyncStorage from '@react-native-async-storage/async-storage';
import { screen, waitFor } from '@testing-library/react-native';

import { fr } from '@/i18n/fr';
import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import { MOTS_TEST, REVISION_TEST } from '@/services/certification/__tests__/fixturesRevision';
import { jourDe, jourPlus } from '@/services/certification/jours';
import { appliquerFaites, cleEtape, cleSerie, etapeDansPlanDuJour, marquerEtapeFaite, planAvecEtapesFaites } from '@/services/certification/planFaites';
import type { EtapePlan, PlanFrise } from '@/services/certification/planFrise';
import { enregistrerProfil } from '@/services/profil';

import { FinSeanceMots } from '../FinSeanceMots';
import { MonPlan } from '../MonPlan';
import { monter } from './harnais';

const t = fr.certification;

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
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));

const AUJ = jourDe(new Date());
const etape = (id: string, extra: Partial<EtapePlan> = {}): EtapePlan => ({
  id, position: 0, type: 'rappel', uniteKind: 'words', uniteId: null, titre: `Étape ${id}`, detail: null, minutes: 5, etat: 'a_faire', faitLe: null, ...extra,
});
const planAvec = (etapes: EtapePlan[], local = false): PlanFrise => ({
  dateExamen: jourPlus(AUJ, 60), couverture: null, local, jours: [{ jour: AUJ, minutes: 5, jourTest: false, etapes }],
});

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: true });
});
afterEach(() => definirApi(null));

describe('Étapes du plan du jour faites sur l’appareil', () => {
  it('clés stables : mots, série, partie, rejeu, mini-test, fiche', () => {
    expect(cleEtape({ type: 'rappel', uniteKind: 'words', uniteId: null })).toBe('mots');
    expect(cleEtape({ type: 'pratique', uniteKind: 'notion', uniteId: 'n1' })).toBe('serie:n1');
    expect(cleEtape({ type: 'decouverte', uniteKind: 'notion', uniteId: 'n1' })).toBe('fiche:n1');
    expect(cleEtape({ type: 'pratique', uniteKind: 'part', uniteId: '5' })).toBe('partie:5');
    expect(cleEtape({ type: 'rappel', uniteKind: 'replay', uniteId: null })).toBe('rejeu');
    expect(cleEtape({ type: 'mini_test', uniteKind: null, uniteId: null })).toBe('mini');
    expect(cleSerie({ notion: 'n1' })).toBe('serie:n1');
    expect(cleSerie({ part: 5 })).toBe('partie:5');
    expect(cleSerie({ rejeu: true })).toBe('rejeu');
    expect(cleSerie({})).toBeNull();
  });

  it('appliquerFaites passe l’étape d’aujourd’hui à « fait » sans toucher aux autres jours', () => {
    const plan = planAvec([etape('a'), etape('b', { type: 'mini_test', uniteKind: null })]);
    plan.jours.push({ jour: jourPlus(AUJ, 1), minutes: 5, jourTest: false, etapes: [etape('c')] });
    const apres = appliquerFaites(plan, AUJ, ['mots']);
    expect(apres.jours[0]!.etapes.map((e) => e.etat)).toEqual(['fait', 'a_faire']);
    expect(apres.jours[0]!.etapes[0]!.faitLe).toBe(AUJ);
    expect(apres.jours[1]!.etapes[0]!.etat).toBe('a_faire');
  });

  it('le repli local est figé pour la journée : l’étape de mots reste après la séance, marquée faite (et non retirée)', async () => {
    const local = planAvec([etape('local-0', { titre: 'Mots à revoir' }), etape('local-1', { type: 'mini_test', uniteKind: null, titre: 'Mini-test' })], true);
    const avant = await planAvecEtapesFaites(local, 'toeic', AUJ);
    expect(avant.jours[0]!.etapes).toHaveLength(2);
    await marquerEtapeFaite('mots');
    // Après la séance, plus aucun mot à revoir : le calcul local ne renvoie plus l'étape de mots.
    const sansMots = planAvec([etape('local-0', { type: 'mini_test', uniteKind: null, titre: 'Mini-test' })], true);
    const apres = await planAvecEtapesFaites(sansMots, 'toeic', AUJ);
    expect(apres.jours[0]!.etapes.map((e) => [e.titre, e.etat])).toEqual([['Mots à revoir', 'fait'], ['Mini-test', 'a_faire']]);
  });

  it('un plan du serveur garde son état et reçoit aussi le journal', async () => {
    const serveur = planAvec([etape('a', { uniteKind: 'notion', uniteId: 'n1', type: 'decouverte' }), etape('b', { uniteKind: 'notion', uniteId: 'n2', type: 'decouverte', etat: 'fait', faitLe: AUJ })]);
    await marquerEtapeFaite('fiche:n1');
    const apres = await planAvecEtapesFaites(serveur, 'toeic', AUJ);
    expect(apres.jours[0]!.etapes.map((e) => e.etat)).toEqual(['fait', 'fait']);
  });

  it('le journal d’hier ne compte pas aujourd’hui', async () => {
    await marquerEtapeFaite('mots', jourPlus(AUJ, -1));
    const apres = await planAvecEtapesFaites(planAvec([etape('a')]), 'toeic', AUJ);
    expect(apres.jours[0]!.etapes[0]!.etat).toBe('a_faire');
  });

  it('etapeDansPlanDuJour : vrai seulement pour une étape du plan mémorisé', async () => {
    await planAvecEtapesFaites(planAvec([etape('a')]), 'toeic', AUJ);
    expect(await etapeDansPlanDuJour('mots')).toBe(true);
    expect(await etapeDansPlanDuJour('mini')).toBe(false);
    expect(await etapeDansPlanDuJour(null)).toBe(false);
  });

  it('parcours complet : séance de mots terminée, la fin confirme la validation et la frise montre « Fait »', async () => {
    definirApi(creerApiFausse({ plan: 'echec', revision: REVISION_TEST, carnet: MOTS_TEST }).api);
    const vue = await monter(<MonPlan />);
    expect(await screen.findByText(t.monPlan.motsLocal)).toBeTruthy();
    expect(screen.queryByText(t.monPlan.statut.fait)).toBeNull();
    vue.unmount();

    await AsyncStorage.setItem('cert.seanceMots', JSON.stringify({
      clientUuid: 's', exam: 'toeic', origine: 'carnet', cartes: MOTS_TEST.slice(0, 2), index: 2, retourne: false, termine: true, enAttente: [],
      resultats: [{ motId: 'w-postpone', connu: true, boiteAvant: 1, boiteApres: 2 }, { motId: 'w-quarterly', connu: false, boiteAvant: 1, boiteApres: 1 }], debut: Date.now(), jour: AUJ,
    }));
    const fin = await monter(<FinSeanceMots />);
    expect(await screen.findByText(t.monPlan.validee)).toBeTruthy();
    fin.unmount();

    // Le carnet n'a plus de mot dû : l'étape reste pourtant dans la frise, avec l'état Fait.
    definirApi(creerApiFausse({ plan: 'echec', revision: REVISION_TEST, carnet: MOTS_TEST.map((m) => ({ ...m, boite: 4, prochaineRevue: '2099-01-01' })) }).api);
    await monter(<MonPlan />);
    expect(await screen.findByText(t.monPlan.motsLocal)).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText(new RegExp(`^${t.monPlan.statut.fait}`)).length).toBeGreaterThan(0));
  });
});
