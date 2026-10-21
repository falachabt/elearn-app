import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { crediterXp, reinitialiserCacheXp, reinitialiserVerrousCreditation } from '@/services/xp';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { NB_CONFETTIS, NB_CONFETTIS_REDUIT, genererParticules } from '../ConfettisCelebration';
import { ToastGainXp } from '../ToastGainXp';

let mockReduit = false;
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock('@/components/useReduireAnimations', () => ({ useReduireAnimations: () => mockReduit }));

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = () => render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair"><ToastGainXp /></ThemeProvider></SafeAreaProvider>);

/** Faux serveur : le total XP est celui de la base, le trigger y ajoute chaque gain inséré. */
const serveur = (totalDepart: number) => {
  let total = totalDepart;
  return {
    from: (table: string) =>
      table === 'xp_history'
        ? { insert: async (l: { xp_gained: number }) => { total += l.xp_gained; return { error: null }; } }
        : { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { total_xp: total }, error: null }) }) }), upsert: async () => ({ error: null }) },
  } as never;
};

beforeEach(async () => {
  mockReduit = false;
  await AsyncStorage.clear();
  reinitialiserCacheXp();
  reinitialiserVerrousCreditation();
});

describe('confettis du passage de niveau', () => {
  it('de vrais confettis : une centaine et plus, formes et couleurs variées, départs sur toute la largeur', () => {
    const p = genererParticules(390);
    expect(p).toHaveLength(NB_CONFETTIS);
    expect(NB_CONFETTIS).toBeGreaterThanOrEqual(100);
    expect(NB_CONFETTIS).toBeLessThanOrEqual(150);
    expect(new Set(p.map((x) => x.forme))).toEqual(new Set(['rectangle', 'cercle', 'ruban']));
    expect(new Set(p.map((x) => x.couleur)).size).toBeGreaterThanOrEqual(6);
    expect(Math.min(...p.map((x) => x.xDepart))).toBeLessThan(100);
    expect(Math.max(...p.map((x) => x.xDepart))).toBeGreaterThan(290);
    // Chute lente : au moins 3,5 fois les 1,8 s d'origine.
    expect(Math.min(...p.map((x) => x.duree))).toBeGreaterThanOrEqual(1800 * 3.5);
  });

  it('bout en bout : un gain d’exercice qui franchit 100 XP sur le serveur lance les confettis', async () => {
    await monter();
    expect(screen.queryByTestId('confettis')).toBeNull();
    await act(async () => { await crediterXp(serveur(95), 'u1', 15, 'exercise', 'ex-1'); });
    expect(await screen.findByText('Niveau 2 débloqué !')).toBeTruthy();
    expect(screen.getByTestId('confettis').children).toHaveLength(NB_CONFETTIS);
  });

  it('un gain qui ne franchit aucun palier ne lance pas de confettis', async () => {
    await monter();
    await act(async () => { await crediterXp(serveur(20), 'u1', 15, 'exercise', 'ex-2'); });
    expect(await screen.findByText('+15 XP')).toBeTruthy();
    expect(screen.queryByTestId('confettis')).toBeNull();
  });

  it('« Réduire les animations » : la célébration reste visible, en version plus légère', async () => {
    mockReduit = true;
    await monter();
    await act(async () => { await crediterXp(serveur(95), 'u1', 15, 'exercise', 'ex-3'); });
    expect(await screen.findByText('Niveau 2 débloqué !')).toBeTruthy();
    expect(screen.getByTestId('confettis').children).toHaveLength(NB_CONFETTIS_REDUIT);
  });
});
