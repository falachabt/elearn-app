import AsyncStorage from '@react-native-async-storage/async-storage';
import { screen } from '@testing-library/react-native';

import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import { jourDe, jourPlus } from '@/services/certification/jours';
import { type EtapePlan, type PlanFrise } from '@/services/certification/planFrise';
import { enregistrerProfil } from '@/services/profil';

import { ReviserToeic } from '../ReviserToeic';
import { monter } from './harnais';


jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
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


describe('Réviser > Parcours : chronologie de tous les jours connus', () => {
  it('affiche les jours passés en « non validé », les jours à venir en aperçu, sans les replier', async () => {
    const passe = jourPlus(AUJ, -2);
    installer({
      plan: plan({
        jours: [
          { jour: passe, minutes: 10, jourTest: false, etapes: [etape('p', { titre: 'Étape passée', etat: 'a_faire' })] },
          ...plan().jours,
        ],
      }),
    });
    await monter(<ReviserToeic />);
    expect(await screen.findByText('Non validé · à refaire')).toBeTruthy();
    // Les jours à venir ne sont pas repliés : leurs étapes sont dessinées (contrairement à Mon plan).
    expect(screen.getByText('Étape c')).toBeTruthy();
    expect(screen.getByText('Étape passée')).toBeTruthy();
  });
});
