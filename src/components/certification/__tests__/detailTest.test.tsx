import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import type { DefTest } from '@/services/certification/types';
import { enregistrerProfil } from '@/services/profil';

import { DetailTest } from '../DetailTest';
import { fr } from '@/i18n/fr';

import { monter } from './harnais';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  // Une fois au montage : le rappel de l'écran change à chaque rendu, il ne doit pas relancer le chargement.
  useFocusEffect: (cb: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => cb(), []);
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), definirProprietesUtilisateur: jest.fn(), drapeauActif: jest.fn(() => true), ecouterDrapeaux: jest.fn(() => () => {}) }));

const def = (id: string, kind: DefTest['kind'], part: number | null, numero: number, extra: Partial<DefTest> = {}): DefTest => ({
  id, kind, part, numero, questions: 100, tentatives: 1, fini: true, meilleurScoreMax: null, derniereDate: null, nouvellesQuestions: 0, ...extra,
});
const LIGNES: DefTest[] = [
  def('l1', 'listening', null, 1, { meilleurScoreMax: 385 }),
  def('m5a', 'mini', 5, 3, { questions: 10 }),
  def('m5b', 'mini', 5, 4, { questions: 10 }),
  def('x1', 'mixed', null, 1, { questions: 20, meilleurScoreMax: 520 }),
];

let fausse: ReturnType<typeof creerApiFausse>;
const installer = (tests: DefTest[]) => {
  fausse = creerApiFausse();
  // Comme le serveur : la liste d'un type ne renvoie que les tests de ce type.
  definirApi({ ...fausse.api, listerDefsTests: async (_exam, type) => tests.filter((t) => !type || t.kind === type) });
};

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = {};
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: true });
  installer(LIGNES);
});
afterEach(() => definirApi(null));

describe('détail d’un test fait : tous les types de la liste', () => {
  it('un mini fini s’ouvre : pas l’erreur de chargement, numéro dans sa partie', async () => {
    mockParams = { kind: 'mini', id: 'm5b', partie: '5' };
    await monter(<DetailTest />);
    // Avant le correctif, le type « mini » était ramené à « listening » : la définition n’était pas
    // dans la liste chargée et l’écran affichait « Impossible de charger tes tests ».
    expect(await screen.findByText('n° 2')).toBeTruthy();
    expect(screen.queryByText(fr.certification.tests.erreurTitre)).toBeNull();
    expect(screen.getByText(fr.certification.tests.detail.refaire)).toBeTruthy();
  });

  it('un mixte fini s’ouvre, meilleur lu sur le total (990)', async () => {
    mockParams = { kind: 'mixed', id: 'x1' };
    await monter(<DetailTest />);
    expect(await screen.findByText('Mixte n° 1')).toBeTruthy();
    expect(screen.queryByText(fr.certification.tests.erreurTitre)).toBeNull();
    expect(screen.getByText('Meilleur score : 520 sur 990')).toBeTruthy();
  });

  it('un demi-test d’écoute fini garde son échelle de section (495)', async () => {
    mockParams = { kind: 'listening', id: 'l1' };
    await monter(<DetailTest />);
    expect(await screen.findByText('Écoute n° 1')).toBeTruthy();
    expect(screen.getByText('Meilleur score : 385 sur 495')).toBeTruthy();
  });
});

describe('actions du détail : les trois boutons vivent pour un mixte (terrain du 27 octobre 2026)', () => {
  // Le mixte fait x1 vient de LIGNES ; on ajoute un mixte non fait x2, cible de « Passer un autre test ».
  const avecMixteAFaire = [...LIGNES, def('x2', 'mixed', null, 2, { questions: 20, fini: false, tentatives: 0 })];
  const installerDemarrage = (tests: DefTest[], demarrerDefTest: unknown) => {
    installer(tests);
    definirApi({
      ...fausse.api,
      listerDefsTests: async (_exam, type) => tests.filter((x) => !type || x.kind === type),
      demarrerDefTest: demarrerDefTest as never,
    });
  };

  it('« Voir ma note et mes tentatives » ouvre l’historique', async () => {
    mockParams = { kind: 'mixed', id: 'x1' };
    await monter(<DetailTest />);
    fireEvent.press(await screen.findByText(fr.certification.tests.detail.voirNote));
    expect(router.push).toHaveBeenCalledWith('/certification/tentatives');
  });

  it('« Refaire » refusé par le serveur : la feuille dit la raison, avec le code vu sur le terrain (TST-UM17)', async () => {
    mockParams = { kind: 'mixed', id: 'x1' };
    installerDemarrage(LIGNES, async () => {
      throw new Error('contenu indisponible');
    });
    await monter(<DetailTest />);
    fireEvent.press(await screen.findByText(fr.certification.tests.detail.refaire));
    expect(await screen.findByText(fr.certification.mini.erreurTitre)).toBeTruthy();
    expect(screen.getByText(fr.certification.mini.erreurCode.replace('{{code}}', 'TST-UM17'))).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalledWith('/certification/mini-test');
  });

  it('« Refaire » accepté rouvre le test', async () => {
    mockParams = { kind: 'mixed', id: 'x1' };
    installerDemarrage(LIGNES, async (clientUuid: string) => fausse.api.demarrerMini(clientUuid, 'toeic', null, 20, '2030-06-01'));
    await monter(<DetailTest />);
    fireEvent.press(await screen.findByText(fr.certification.tests.detail.refaire));
    await screen.findByText('Mixte n° 1');
    expect(router.replace).toHaveBeenCalledWith('/certification/mini-test');
  });

  it('« Passer un autre test » : le refus du test conseillé s’explique au lieu de rester silencieux', async () => {
    mockParams = { kind: 'mixed', id: 'x1' };
    installerDemarrage(avecMixteAFaire, async () => {
      throw new Error('contenu indisponible');
    });
    await monter(<DetailTest />);
    fireEvent.press(await screen.findByText(fr.certification.tests.detail.autre));
    // Avant le correctif, l'échec remontait sans être attrapé dans le détail : aucune feuille,
    // aucune navigation — le bouton semblait mort.
    expect(await screen.findByText(fr.certification.mini.erreurTitre)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalledWith('/certification/mini-test');
  });

  it('« Passer un autre test » accepté lance le test conseillé', async () => {
    mockParams = { kind: 'mixed', id: 'x1' };
    installerDemarrage(avecMixteAFaire, async (clientUuid: string) => fausse.api.demarrerMini(clientUuid, 'toeic', null, 20, '2030-06-01'));
    await monter(<DetailTest />);
    fireEvent.press(await screen.findByText(fr.certification.tests.detail.autre));
    await screen.findByText('Mixte n° 1');
    expect(router.replace).toHaveBeenCalledWith('/certification/mini-test');
  });

  it('« Refaire » sans crédits : la feuille des crédits explique (demi-test)', async () => {
    mockParams = { kind: 'listening', id: 'l1' };
    installerDemarrage(LIGNES, async () => ({ status: 'insufficient' as const, tentative: null, cout: 8, solde: 2 }));
    await monter(<DetailTest />);
    fireEvent.press(await screen.findByText(fr.certification.tests.detail.refaire));
    expect(await screen.findByText(fr.certification.mini.insuffisantTexte)).toBeTruthy();
    expect(screen.getByText(fr.certification.mini.insuffisantSolde.replace('{{n}}', '2'))).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalledWith('/certification/mini-test');
  });
});
