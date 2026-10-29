import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { definirApi } from '@/services/certification/api';
import { ecrirePlan } from '@/services/certification/etat';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import type { DefTest } from '@/services/certification/types';
import { enregistrerProfil } from '@/services/profil';

import { ListeTests } from '../ListeTests';
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
jest.mock('@/session/CreditsProvider', () => ({
  useCredits: () => ({
    solde: { illimite: false, total: 12, semaine: 0, recompenses: 0, recharge: 25, rechargeHebdo: true, prochaineRecharge: '2026-10-19T00:00:00Z', illimiteJusqua: null, expirationRecompenses: null },
    reglages: { bienvenue: 40, invite: 5, recharge: 25 },
    couts: { cert_mock_mini_ten: 1, cert_mock_mini_twenty: 2 },
    depenser: jest.fn(),
    rafraichir: jest.fn(),
  }),
}));

const mini = (id: string, part: number | null, numero: number, extra: Partial<DefTest> = {}): DefTest => ({
  id, kind: 'mini', part, numero, questions: 10, tentatives: 0, fini: false, meilleurScoreMax: null, derniereDate: null, nouvellesQuestions: 10, ...extra,
});
const LIGNES: DefTest[] = [
  mini('a', 1, 1, { fini: true, tentatives: 1, meilleurScoreMax: 8, nouvellesQuestions: 0 }),
  mini('b', 1, 2),
  mini('c', 5, 3, { fini: true, tentatives: 1, meilleurScoreMax: 7, nouvellesQuestions: 0 }),
  mini('d', 5, 4, { tentatives: 1, nouvellesQuestions: 6 }),
  mini('e', 5, 5),
  { ...mini('m', null, 1, { questions: 20 }), kind: 'mixed' },
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

describe('liste des mini-tests d’une partie (v39)', () => {
  it('ne montre que la partie choisie, numérotée dans la partie', async () => {
    mockParams = { kind: 'mini', partie: '5' };
    await monter(<ListeTests />);
    expect(await screen.findByText('n° 1')).toBeTruthy();
    expect(screen.getByTestId('ligne-mini-3')).toBeTruthy();
    expect(screen.getByTestId('ligne-mini-5')).toBeTruthy();
    expect(screen.queryByTestId('ligne-mini-1')).toBeNull();
    // Le meilleur s'écrit en compact au-dessus de la barre (« 7 sur 10 »), plus en phrase « Meilleur : … ».
    expect(screen.getByText(/7 sur 10/)).toBeTruthy();
  });

  it('sans partie valide, renvoie vers le choix de la partie', async () => {
    mockParams = { kind: 'mini' };
    await monter(<ListeTests />);
    expect(router.replace).toHaveBeenCalledWith('/certification/choix-partie');
  });

  it('le mixte liste ses tests sous leur type, sans partie', async () => {
    mockParams = { kind: 'mixed' };
    await monter(<ListeTests />);
    expect(await screen.findByText('Mixte n° 1')).toBeTruthy();
    expect(screen.getByTestId('ligne-mixed-1')).toBeTruthy();
  });
});

describe('total affiché sur les cartes (décision de Benny du 25 octobre 2026)', () => {
  it('un mini affiche son total réel, pas ses questions nouvelles (cas de la capture : 10 au lieu de 6 nouvelles)', async () => {
    mockParams = { kind: 'mini', partie: '2' };
    installer([
      mini('p2a', 2, 1, { nouvellesQuestions: 5 }),
      mini('p2b', 2, 2, { nouvellesQuestions: 6 }),
    ]);
    await monter(<ListeTests />);
    expect(await screen.findByText('n° 1')).toBeTruthy();
    // Une ligne de méta par carte (« Tentatives : N · 10 questions »), au total de la définition (10),
    // jamais la nouveauté (5 ou 6).
    expect(screen.getAllByText(/· 10 questions/)).toHaveLength(2);
    expect(screen.queryByText(/questions nouvelles pour toi/)).toBeNull();
  });

  it('un demi-test affiche son total réel (100), pas ses questions nouvelles (76)', async () => {
    mockParams = { kind: 'listening' };
    installer([{ ...mini('l1', null, 1, { questions: 100, nouvellesQuestions: 76 }), kind: 'listening' }]);
    await monter(<ListeTests />);
    expect(await screen.findByText('Écoute n° 1')).toBeTruthy();
    expect(screen.getByText(/· 100 questions/)).toBeTruthy();
    expect(screen.queryByText(/questions nouvelles pour toi/)).toBeNull();
  });
});

describe('départ depuis la liste d’un mini-test (v39)', () => {
  it('le coût du mini-test est affiché dans la liste de la partie, avec son nombre de questions', async () => {
    mockParams = { kind: 'mini', partie: '5' };
    await monter(<ListeTests />);
    expect(await screen.findByText(`10 questions · ${fr.credits.coutUn} hors Pass`)).toBeTruthy();
  });

  it('une partie servie à 12 questions l’annonce dans l’en-tête (partie 6, nombre lu dans les définitions)', async () => {
    mockParams = { kind: 'mini', partie: '6' };
    installer([
      mini('g', 6, 1, { questions: 12, nouvellesQuestions: 12 }),
      mini('h', 6, 2, { questions: 12, nouvellesQuestions: 12 }),
    ]);
    await monter(<ListeTests />);
    expect(await screen.findByText(`12 questions · ${fr.credits.coutUn} hors Pass`)).toBeTruthy();
  });

  it('crédits insuffisants : le serveur refuse, la feuille des crédits explique, aucun test ne s’ouvre', async () => {
    mockParams = { kind: 'mini', partie: '5' };
    const demarrer = jest.fn(async (_clientUuid: string, _defId: string, _exam: string, _jour: string) => ({ status: 'insufficient' as const, tentative: null, cout: 1, solde: 0 }));
    definirApi({ ...fausse.api, listerDefsTests: async (_e, type) => LIGNES.filter((l) => !type || l.kind === type), demarrerDefTest: demarrer });
    await monter(<ListeTests />);
    fireEvent.press(await screen.findByTestId('ligne-mini-4'));
    // Un blocage se présente par une feuille du bas qui dit la raison (plus le petit texte sous la liste).
    expect(await screen.findByText(fr.certification.mini.insuffisantTexte)).toBeTruthy();
    expect(screen.getByText(fr.certification.mini.insuffisantTitre.replace('{{cout}}', fr.credits.coutUn))).toBeTruthy();
    expect(demarrer.mock.calls[0]?.[1]).toBe('d');
    expect(demarrer.mock.calls[0]?.[2]).toBe('toeic');
    expect(router.push).not.toHaveBeenCalledWith('/certification/mini-test');
    expect(router.replace).not.toHaveBeenCalledWith('/certification/mini-test');
  });

  it('départ accepté : la tentative du serveur est gardée et l’écran du mini-test s’ouvre', async () => {
    mockParams = { kind: 'mini', partie: '5' };
    definirApi({
      ...fausse.api,
      listerDefsTests: async (_e, type) => LIGNES.filter((l) => !type || l.kind === type),
      demarrerDefTest: async (clientUuid) => fausse.api.demarrerMini(clientUuid, 'toeic', 5, 10, '2030-06-01'),
    });
    await monter(<ListeTests />);
    fireEvent.press(await screen.findByTestId('ligne-mini-5'));
    await screen.findByTestId('ligne-mini-5');
    expect(router.replace).toHaveBeenCalledWith('/certification/mini-test');
  });
});

describe('liste des mixtes : échelle du meilleur et départ (terrain du 27 octobre 2026)', () => {
  const mixtes: DefTest[] = [
    { ...mini('x1', null, 1, { questions: 20, fini: true, tentatives: 1, meilleurScoreMax: 550, nouvellesQuestions: 0 }), kind: 'mixed' },
    { ...mini('x2', null, 2, { questions: 20 }), kind: 'mixed' },
  ];
  const installerMixtes = (demarrerDefTest?: unknown) => {
    installer(mixtes);
    if (demarrerDefTest) {
      definirApi({
        ...fausse.api,
        listerDefsTests: async (_e, type) => mixtes.filter((l) => !type || l.kind === type),
        demarrerDefTest: demarrerDefTest as never,
      });
    }
  };

  it('le meilleur d’un mixte se lit sur le total (990), jamais sur ses 20 questions', async () => {
    mockParams = { kind: 'mixed' };
    installerMixtes();
    await monter(<ListeTests />);
    expect(await screen.findByText(/550 sur 990/)).toBeTruthy();
    expect(screen.queryByText(/sur 20/)).toBeNull();
  });

  it('un mixte non fait refusé par le serveur : la feuille dit la raison, avec le code vu sur le terrain (TST-UM17)', async () => {
    mockParams = { kind: 'mixed' };
    installerMixtes(async () => {
      throw new Error('contenu indisponible');
    });
    await monter(<ListeTests />);
    fireEvent.press(await screen.findByTestId('ligne-mixed-2'));
    // Avant le correctif, le code d'échec partait en petit texte sous la liste, hors écran :
    // toucher un mixte non fait semblait ne rien faire.
    expect(await screen.findByText(fr.certification.mini.erreurTitre)).toBeTruthy();
    expect(screen.getByText(fr.certification.mini.erreurCode.replace('{{code}}', 'TST-UM17'))).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalledWith('/certification/mini-test');
  });

  it('un mixte non fait accepté démarre', async () => {
    mockParams = { kind: 'mixed' };
    installerMixtes(async (clientUuid: string) => fausse.api.demarrerMini(clientUuid, 'toeic', null, 20, '2030-06-01'));
    await monter(<ListeTests />);
    fireEvent.press(await screen.findByTestId('ligne-mixed-2'));
    await screen.findByTestId('ligne-mixed-2');
    expect(router.replace).toHaveBeenCalledWith('/certification/mini-test');
  });
});

describe('barre du meilleur, repère objectif et bloc collé (maquette validée par Benny le 29 octobre 2026)', () => {
  const styleDe = (testID: string, index = 0) =>
    StyleSheet.flatten(screen.getAllByTestId(testID)[index]?.props.style) as Record<string, unknown>;
  const mixtes: DefTest[] = [
    { ...mini('y1', null, 1, { questions: 20, fini: true, tentatives: 1, meilleurScoreMax: 980, nouvellesQuestions: 0 }), kind: 'mixed' },
    { ...mini('y2', null, 2, { questions: 20 }), kind: 'mixed' },
  ];

  it('fait au-dessus de l’objectif : repère à sa position, valeur « 800 » au-dessus, aucune légende textuelle', async () => {
    mockParams = { kind: 'mixed' };
    installer(mixtes);
    await ecrirePlan({ exam: 'toeic', objectif: 800 });
    await monter(<ListeTests />);
    expect(await screen.findByText(/980 sur 990/)).toBeTruthy();
    // Un repère par ligne (faite ou non), à la position de l'objectif sur l'échelle totale.
    expect(screen.getAllByTestId('repere-objectif')).toHaveLength(2);
    expect(styleDe('repere-objectif').left).toBe(`${(800 / 990) * 100}%`);
    // La valeur s'écrit en petit juste au-dessus du repère — et c'est le seul texte d'objectif visible :
    // aucune légende (« Objectif : 800 ») ne fait passer la ligne à la ligne (ajustement de Benny).
    expect(screen.getAllByTestId('repere-valeur').map((el) => el.props.children)).toEqual([800, 800]);
    expect(screen.queryByText(/Objectif/)).toBeNull();
    // La position par rapport à l'objectif vit dans le libellé d'accessibilité de la barre.
    const barre = screen.getByLabelText(/au-dessus de ton objectif de 800/);
    expect(barre.props.accessibilityValue).toEqual({ min: 0, max: 990, now: 980 });
  });

  it('fait en dessous de l’objectif : le libellé de la barre le dit, le repère reste à l’objectif', async () => {
    mockParams = { kind: 'mixed' };
    installer([
      { ...mini('z1', null, 1, { questions: 20, fini: true, tentatives: 2, meilleurScoreMax: 550, nouvellesQuestions: 0 }), kind: 'mixed' },
    ]);
    await ecrirePlan({ exam: 'toeic', objectif: 800 });
    await monter(<ListeTests />);
    expect(await screen.findByText(/550 sur 990/)).toBeTruthy();
    expect(screen.getByLabelText(/en dessous de ton objectif de 800/)).toBeTruthy();
    expect(styleDe('repere-objectif').left).toBe(`${(800 / 990) * 100}%`);
  });

  it('pas encore fait : piste vide, repère déjà visible avec sa valeur', async () => {
    mockParams = { kind: 'mixed' };
    installer(mixtes);
    await ecrirePlan({ exam: 'toeic', objectif: 800 });
    await monter(<ListeTests />);
    expect(await screen.findByText('Mixte n° 2')).toBeTruthy();
    // La ligne non faite a sa barre (valeur 0) et le même repère que la ligne faite.
    const barres = screen.getAllByRole('progressbar');
    expect(barres.map((b) => b.props.accessibilityValue.now)).toEqual([980, 0]);
    expect(screen.getAllByTestId('repere-objectif')).toHaveLength(2);
    expect(screen.getByLabelText(/Ton objectif : 800/)).toBeTruthy();
  });

  it('sans objectif défini : la barre reste, aucun repère n’est inventé', async () => {
    mockParams = { kind: 'mixed' };
    installer(mixtes);
    await monter(<ListeTests />);
    expect(await screen.findByText(/980 sur 990/)).toBeTruthy();
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
    expect(screen.queryByTestId('repere-objectif')).toBeNull();
    expect(screen.queryByTestId('repere-valeur')).toBeNull();
  });

  it('mini par partie : barre sur les questions, jamais de repère (échelles incompatibles)', async () => {
    mockParams = { kind: 'mini', partie: '5' };
    await ecrirePlan({ exam: 'toeic', objectif: 800 });
    await monter(<ListeTests />);
    expect(await screen.findByText(/7 sur 10/)).toBeTruthy();
    expect(screen.queryByTestId('repere-objectif')).toBeNull();
    const barres = screen.getAllByRole('progressbar');
    expect(barres[0]?.props.accessibilityValue).toEqual({ min: 0, max: 10, now: 7 });
  });

  it('demi-test : le repère se place à la moitié de l’objectif, sa valeur est celle de la section', async () => {
    mockParams = { kind: 'listening' };
    installer([
      { ...mini('l1', null, 1, { questions: 100, fini: true, tentatives: 1, meilleurScoreMax: 450, nouvellesQuestions: 0 }), kind: 'listening' },
    ]);
    await ecrirePlan({ exam: 'toeic', objectif: 800 });
    await monter(<ListeTests />);
    // « 450 sur 495 » vit dans l'en-tête (meilleur de la section) et, désormais, sur la ligne elle-même.
    expect((await screen.findAllByText(/450 sur 495/)).length).toBe(2);
    // Position et valeur écrite : 400 sur l'échelle 495 — le libellé d'accessibilité parle de l'objectif total (800).
    expect(styleDe('repere-objectif').left).toBe(`${(400 / 495) * 100}%`);
    expect(screen.getByTestId('repere-valeur').props.children).toBe(400);
    expect(screen.getByLabelText(/au-dessus de ton objectif de 800/)).toBeTruthy();
  });

  it('bloc collé unique : pas de contour par ligne, un trait fin entre les lignes', async () => {
    mockParams = { kind: 'mixed' };
    installer(mixtes);
    await monter(<ListeTests />);
    expect(await screen.findByText('Mixte n° 1')).toBeTruthy();
    // Avant : chaque ligne était une carte bordée (borderWidth 2). Dans le bloc, seule la première
    // ligne n'a pas de séparateur ; les suivantes portent le trait fin du patron ListeCollee.
    expect(styleDe('ligne-mixed-1').borderWidth).toBeUndefined();
    expect(styleDe('ligne-mixed-1').borderTopWidth).toBeUndefined();
    expect(styleDe('ligne-mixed-2').borderTopWidth).toBe(1.5);
  });
});
