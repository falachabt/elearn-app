import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { fr } from '@/i18n/fr';
import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import { jourDe, jourPlus } from '@/services/certification/jours';
import { lirePlanServeur, organiserFrise, routeEtape, type EtapePlan, type PlanFrise } from '@/services/certification/planFrise';
import { enregistrerProfil } from '@/services/profil';

import { MonPlan } from '../MonPlan';
import { ReviserToeic } from '../ReviserToeic';
import { monter } from './harnais';

const t = fr.certification.monPlan;
const LIGNE_AUJOURDHUI = /^Aujourd’hui · /;

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
  id, position: 0, type: 'decouverte', uniteKind: 'notion', uniteId: `n-${id}`, titre: `Étape ${id}`, detail: null, minutes: 3, etat: 'a_faire', faitLe: null, ...extra,
});
const plan = (extra: Partial<PlanFrise> = {}): PlanFrise => ({
  dateExamen: jourPlus(AUJ, 60),
  couverture: { unites: 40, vues: 12, validees: 6, maitrisees: 2, pourcent: 100 },
  local: false,
  jours: [
    { jour: AUJ, minutes: 13, jourTest: false, etapes: [etape('a', { etat: 'reportee' }), etape('b', { type: 'mini_test', uniteKind: null, uniteId: null, etat: 'en_cours', minutes: 10, position: 1 })] },
    { jour: jourPlus(AUJ, 1), minutes: 7, jourTest: false, etapes: [etape('c'), etape('d', { position: 1 })] },
    { jour: jourPlus(AUJ, 30), minutes: 120, jourTest: true, etapes: [etape('e', { type: 'test_complet', titre: 'Test complet', uniteKind: null, uniteId: null })] },
  ],
  ...extra,
});

let fausse: ReturnType<typeof creerApiFausse>;
const installer = (options: Parameters<typeof creerApiFausse>[0] = {}) => {
  fausse = creerApiFausse(options);
  definirApi(fausse.api);
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: true });
});
afterEach(() => definirApi(null));

describe('Plan servi : lecture et organisation', () => {
  it('lit la forme du serveur et renvoie null tant que rien n est construit', () => {
    expect(lirePlanServeur(null)).toBeNull();
    expect(lirePlanServeur({ days: [] })).toBeNull();
    const p = lirePlanServeur({
      exam_date: '2027-01-16',
      coverage: { units: 120, seen: 34, validated: 11, mastered: 4, planned_pct: 78 },
      days: [{ day: '2026-11-14', minutes: 10, steps: [{ id: 's1', position: 0, kind: 'discover', unit_kind: 'notion', unit_id: 'n1', title: 'Voix passive', minutes: 3, state: 'postponed' }] }],
    });
    expect(p?.dateExamen).toBe('2027-01-16');
    expect(p?.couverture).toEqual({ unites: 120, vues: 34, validees: 11, maitrisees: 4, pourcent: 78 });
    expect(p?.jours[0].etapes[0]).toMatchObject({ type: 'decouverte', etat: 'reportee', uniteId: 'n1' });
  });

  it('lit la forme réelle de cert_plan_get : une ligne par notion {day, position, notion_id, title, family, done}', () => {
    const p = lirePlanServeur([
      { day: '2026-11-15', position: 1, notion_id: 'n2', title: 'Prépositions', family: 'grammaire', done: false },
      { day: '2026-11-14', position: 0, notion_id: 'n1', title: 'Voix passive', family: 'grammaire', done: true },
      { day: '2026-11-14', position: 1, notion_id: 'n3', title: 'Faux amis', family: 'piege', done: false },
    ]);
    expect(p?.jours.map((j) => j.jour)).toEqual(['2026-11-14', '2026-11-15']);
    expect(p?.jours[0].etapes[0]).toMatchObject({ titre: 'Voix passive', etat: 'fait', uniteKind: 'notion', uniteId: 'n1', detail: 'grammaire' });
    expect(p?.jours[0].etapes[1]).toMatchObject({ titre: 'Faux amis', etat: 'a_faire' });
    expect(routeEtape(p!.jours[0].etapes[1])).toEqual({ pathname: '/certification/notion/[id]', params: { id: 'n3', source: 'liste' } });
  });

  it('range aujourd hui, demain, les jours de test et les semaines suivantes', () => {
    const f = organiserFrise(plan(), AUJ);
    expect(f.aujourdhui.etapes).toHaveLength(2);
    expect(f.demain?.jour).toBe(jourPlus(AUJ, 1));
    expect([...f.tests, ...f.suivants, ...f.semaines.flatMap((s) => s.jours)].some((j) => j.jourTest)).toBe(true);
  });

  it('chaque type d étape ouvre sa destination', () => {
    expect(routeEtape(etape('x', { type: 'mini_test' }))).toBe('/certification/mini');
    expect(routeEtape(etape('x', { type: 'test_complet' }))).toBe('/tests');
    expect(routeEtape(etape('x', { type: 'decouverte', uniteId: 'n1' }))).toEqual({ pathname: '/certification/notion/[id]', params: { id: 'n1', source: 'liste' } });
    expect(routeEtape(etape('x', { type: 'rappel', uniteKind: 'words', uniteId: null }))).toMatchObject({ pathname: '/certification/mots-seance' });
  });
});

describe('D3 · Mon plan en frise', () => {
  it('affiche aujourd’hui en simple ligne de texte, sans bandeau de couverture, avec les statuts en mots', async () => {
    installer({ plan: plan() });
    await monter(<MonPlan />);
    expect(await screen.findByText(LIGNE_AUJOURDHUI)).toBeTruthy();
    // Retouche de novembre 2026 : ni bandeau « Jusqu’au … », ni phrase de couverture ; la ligne du jour n’est pas un bouton.
    expect(screen.queryByText(/^Jusqu’au /)).toBeNull();
    expect(screen.queryByText(/Notions vues/)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Aujourd’hui/ })).toBeNull();
    expect(screen.getByText(t.statut.reportee)).toBeTruthy();
    expect(screen.getAllByText(t.statut.en_cours).length).toBeGreaterThan(0);
    // demain est replié : ses étapes ne sont pas dessinées
    expect(screen.queryByText('Étape c')).toBeNull();
    expect(screen.getByLabelText(new RegExp(`^${t.demain}\\.`))).toBeTruthy();
  });

  it('toucher une étape l ouvre, toucher un jour ouvre son détail, le bouton lance l étape en cours', async () => {
    installer({ plan: plan() });
    await monter(<MonPlan />);
    await fireEvent.press(await screen.findByLabelText(/Étape a\./));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/notion/[id]', params: { id: 'n-a', source: 'liste' } });
    await fireEvent.press(screen.getByLabelText(new RegExp(`^${t.demain}\\.`)));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/plan-jour', params: { jour: jourPlus(AUJ, 1) } });
    await fireEvent.press(screen.getByText(t.commencerEtape.replace('{{titre}}', 'étape b')));
    expect(router.push).toHaveBeenCalledWith('/certification/mini');
  });

  it('construit le plan quand le serveur n en a pas encore', async () => {
    installer({ plan: null, planConstruit: plan() });
    await monter(<MonPlan />);
    expect(await screen.findByText(LIGNE_AUJOURDHUI)).toBeTruthy();
    expect(fausse.appels.plansConstruits).toBe(1);
  });

  it('repli local quand l appel échoue', async () => {
    installer({ plan: 'echec' });
    await monter(<MonPlan />);
    expect((await screen.findAllByText(t.miniLocal)).length).toBeGreaterThan(0);
    // Retouche de novembre 2026 : plus de phrase « Plan de cet appareil », ni de bandeau « Jusqu’au … ».
    expect(screen.queryByText(/Plan de cet appareil/)).toBeNull();
    expect(screen.queryByText(/^Jusqu’au /)).toBeNull();
  });

  it('sans date : invitation, pas de frise, mission du jour', async () => {
    installer({ plan: plan({ dateExamen: null, couverture: null }) });
    await monter(<MonPlan />);
    expect(await screen.findByText(t.sansDateTitre)).toBeTruthy();
    expect(screen.queryByLabelText(new RegExp(`^${t.demain}\\.`))).toBeNull();
    await fireEvent.press(screen.getByText(t.choisirDate));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/objectif', params: { modifier: '1' } });
    expect(screen.getByText(t.commencerMission)).toBeTruthy();
  });

  it('trop de contenu : trois étapes puis le lien des étapes restantes (plus de bandeau de couverture)', async () => {
    const lourd = plan({
      couverture: { unites: 120, vues: 34, validees: 11, maitrisees: 4, pourcent: 78 },
      jours: [{ jour: AUJ, minutes: 20, jourTest: false, etapes: [1, 2, 3, 4, 5].map((i) => etape(`z${i}`, { position: i })) }, { jour: jourPlus(AUJ, 1), minutes: 6, jourTest: false, etapes: [etape('y')] }],
    });
    installer({ plan: lourd });
    await monter(<MonPlan />);
    expect(await screen.findByText('Étape z1')).toBeTruthy();
    expect(screen.queryByText(t.couvertureLimitee.replace('{{pct}}', '78'))).toBeNull();
    expect(screen.queryByText('Étape z5')).toBeNull();
    await fireEvent.press(screen.getByText(t.voirRestantes.replace('{{n}}', '3')));
    expect(screen.getByText('Étape z5')).toBeTruthy();
    expect(screen.getAllByText('Étape y').length).toBeGreaterThan(1);
  });

  it('erreur : message et réessai quand même le calcul local est impossible', async () => {
    installer({ plan: 'echec', revision: 'echec' });
    await monter(<MonPlan />);
    expect(await screen.findByText(fr.certification.reviser.erreurTitre)).toBeTruthy();
    expect(screen.getByText(fr.certification.reessayer)).toBeTruthy();
  });

  it('thème sombre : même contenu', async () => {
    installer({ plan: plan() });
    await monter(<MonPlan />, 'sombre');
    expect(await screen.findByText(LIGNE_AUJOURDHUI)).toBeTruthy();
  });
});

describe('Réviser · Parcours en frise', () => {
  it('montre la frise à la place du menu de quatre lignes', async () => {
    installer({ plan: plan() });
    await monter(<ReviserToeic />);
    expect(await screen.findByText(LIGNE_AUJOURDHUI)).toBeTruthy();
    expect(screen.queryByText(fr.certification.reviser.partiesTitre)).toBeNull();
  });
});
