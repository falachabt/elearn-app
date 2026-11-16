import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet, type ViewStyle } from 'react-native';

import { definirApi } from '@/services/certification/api';
import { creerApiFausse } from '@/services/certification/__tests__/apiFausse';
import { REVISION_TEST } from '@/services/certification/__tests__/fixturesRevision';
import { jourDe, jourPlus, lundiDe } from '@/services/certification/jours';
import type { EtapePlan, PlanFrise } from '@/services/certification/planFrise';
import { enregistrerProfil } from '@/services/profil';
import { themes } from '@/theme/theme';

import { CarteMaitrise } from '../CarteMaitrise';
import { MonPlan } from '../MonPlan';
import { PourquoiRate } from '../PourquoiRate';
import { TuilesCollees } from '../ui';
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

const style = (noeud: { props: { style?: unknown } }): ViewStyle => (StyleSheet.flatten(noeud.props.style as ViewStyle) ?? {}) as ViewStyle;

/** Remonte jusqu'au bloc collé (un seul contour, coins arrondis, contenu rogné) qui porte la ligne. */
const blocDe = (noeud: { parent: unknown; props: { style?: unknown } }) => {
  let courant = noeud as { parent: unknown; props: { style?: unknown } } | null;
  while (courant) {
    const s = style(courant);
    if ((s.borderWidth ?? 0) > 0 && s.overflow === 'hidden') return courant;
    courant = courant.parent as typeof courant;
  }
  return null;
};

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: true });
});
afterEach(() => definirApi(null));

describe('Listes collées des écrans TOEIC', () => {
  it('« Pourquoi j’ai raté ? » : les quatre raisons sont dans un seul bloc, sans contour propre', async () => {
    await monter(<PourquoiRate ouverte onFermer={() => {}} onChoisir={() => {}} />);
    const lignes = screen.getAllByRole('button').filter((b) => /, /.test(String(b.props.accessibilityLabel)));
    expect(lignes).toHaveLength(4);
    const blocs = new Set(lignes.map((l) => blocDe(l)));
    expect(blocs.size).toBe(1);
    expect([...blocs][0]).not.toBeNull();
    lignes.forEach((l, i) => {
      expect(style(l).borderWidth).toBeUndefined();
      if (i === 0) expect(style(l).borderTopWidth).toBeUndefined();
      else expect(style(l).borderTopWidth).toBeGreaterThan(0);
    });
  });

  it('Carte de maîtrise : les sept parties forment un seul bloc collé et restent touchables', async () => {
    definirApi(creerApiFausse({ revision: REVISION_TEST }).api);
    await monter(<CarteMaitrise />);
    const lignes = (await screen.findAllByRole('button')).filter((b) => /^Partie \d, /.test(String(b.props.accessibilityLabel)));
    expect(lignes).toHaveLength(7);
    expect(new Set(lignes.map((l) => blocDe(l))).size).toBe(1);
    lignes.forEach((l, i) => {
      expect(style(l).borderWidth).toBeUndefined();
      expect(style(l).borderTopWidth === undefined).toBe(i === 0);
    });
    fireEvent.press(lignes[4]!);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/partie', params: { n: '5' } });
  });

  it('Tuiles chiffrées : un seul bloc, des séparateurs fins, la tuile touchable appelle son action', async () => {
    const onPress = jest.fn();
    await monter(
      <TuilesCollees
        tuiles={[
          { cle: 'a', titre: '12', aide: 'Vus' },
          { cle: 'b', titre: '3', aide: 'Validés', onPress },
          { cle: 'c', titre: '5', aide: 'Maîtrisés' },
        ]}
      />,
    );
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('Vus')).toBeTruthy();
    const touchable = screen.getByLabelText('3. Validés');
    expect(blocDe(touchable)).not.toBeNull();
    expect(style(touchable).borderLeftWidth).toBeGreaterThan(0);
    expect(style(touchable).borderWidth).toBeUndefined();
    await fireEvent.press(touchable);
    expect(onPress).toHaveBeenCalledTimes(1);
    // Une seule rangée de deux cases + une rangée incomplète complétée par une case vide : un seul bloc.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('Tuiles chiffrées, thème sombre : fond de surface du thème', async () => {
    await monter(<TuilesCollees tuiles={[{ cle: 'a', titre: '1', aide: 'Un', onPress: () => {} }, { cle: 'b', titre: '2', aide: 'Deux', onPress: () => {} }]} />, 'sombre');
    expect(style(screen.getByLabelText('1. Un')).backgroundColor).toBe(themes.dark.fond.surface);
  });

  it('Mon plan : les jours d’une semaine repliée s’ouvrent en un seul bloc collé', async () => {
    const auj = jourDe(new Date());
    const lundi = lundiDe(jourPlus(auj, 14));
    const etape = (id: string): EtapePlan => ({ id, position: 0, type: 'decouverte', uniteKind: 'notion', uniteId: `n-${id}`, titre: `Étape ${id}`, detail: null, minutes: 3, etat: 'a_faire', faitLe: null });
    const plan: PlanFrise = {
      dateExamen: jourPlus(auj, 60),
      couverture: { unites: 40, vues: 12, validees: 6, maitrisees: 2, pourcent: 100 },
      local: false,
      jours: [
        { jour: auj, minutes: 3, jourTest: false, etapes: [etape('a')] },
        { jour: lundi, minutes: 3, jourTest: false, etapes: [etape('b')] },
        { jour: jourPlus(lundi, 1), minutes: 3, jourTest: false, etapes: [etape('c')] },
        { jour: jourPlus(lundi, 2), minutes: 3, jourTest: false, etapes: [etape('d')] },
      ],
    };
    definirApi(creerApiFausse({ plan }).api);
    await monter(<MonPlan />);
    await fireEvent.press(await screen.findByLabelText(/^Semaine du /));
    const jours = screen.getAllByRole('button').filter((b) => /1 étape$/.test(String(b.props.accessibilityLabel)));
    expect(jours).toHaveLength(3);
    expect(new Set(jours.map((j) => blocDe(j))).size).toBe(1);
    jours.forEach((j, i) => {
      expect(style(j).borderWidth).toBeUndefined();
      expect(style(j.children[0] as never).borderWidth).toBe(0);
      expect(style(j.children[0] as never).borderTopWidth === undefined).toBe(i === 0);
    });
  });
});
