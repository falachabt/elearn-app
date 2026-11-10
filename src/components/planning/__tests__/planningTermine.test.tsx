import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { BackHandler } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  calculerBilanPlanning,
  planningEstTermine,
  type Planning,
} from '@/services/planning';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { PlanningTermine } from '../PlanningTermine';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useFocusEffect: (f: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual('react');
    useEffect(f, [f]);
  },
}));

jest.mock('@/services/supabase', () => ({
  getSupabase: () => ({
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  }),
}));

jest.mock('@/session/SessionProvider', () => ({
  useSession: () => ({
    session: { user: { id: 'user-test-123' } },
  }),
}));

const PLAN_TERMINE: Planning = {
  statut: 'ready',
  minutesParJour: 45,
  cible: { type: 'examen', libelle: 'Baccalauréat 2026', date: '2026-06-23', statut: 'confirmee' },
  joursRestants: 0,
  couverture: { total: 40, prevues: 40 },
  semaines: [
    {
      debut: '2026-06-01',
      phase: 'learning',
      jours: [
        {
          jour: '2026-06-01',
          phase: 'learning',
          minutes: 45,
          fait: true,
          elements: [
            { genre: 'lecon', matiere: 'Maths', cours: 'Fonctions', lecon: 'Limites', minutes: 25, coursId: 1, leconId: 101 },
            { genre: 'quiz', matiere: 'Maths', cours: 'Fonctions', quiz: 'Quiz 1', questions: 5, minutes: 20, coursId: 1, quizId: 'q1' },
          ],
        },
      ],
    },
    {
      debut: '2026-06-08',
      phase: 'past_papers',
      jours: [
        {
          jour: '2026-06-08',
          phase: 'past_papers',
          minutes: 45,
          fait: true,
          elements: [{ genre: 'annales', dossier: 'Bac 2024', minutes: 45 }],
        },
      ],
    },
    {
      debut: '2026-06-15',
      phase: 'final_review',
      jours: [
        {
          jour: '2026-06-15',
          phase: 'final_review',
          minutes: 45,
          fait: true,
          elements: [{ genre: 'revisionFinale' }],
        },
      ],
    },
  ],
};

jest.mock('@/services/planning', () => {
  const actual = jest.requireActual('@/services/planning');
  return {
    ...actual,
    lirePlanning: jest.fn().mockImplementation(() => Promise.resolve({ planning: PLAN_TERMINE, copie: false })),
  };
});

const metriques = { frame: { x: 0, y: 0, width: 360, height: 780 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = async (ui: React.ReactElement) =>
  await render(
    <SafeAreaProvider initialMetrics={metriques}>
      <ThemeProvider reglage="clair">{ui}</ThemeProvider>
    </SafeAreaProvider>,
  );

describe('Bilan & Fin de Planning', () => {
  it('planningEstTermine détecte un planning dont tous les jours sont faits ou joursRestants <= 0', () => {
    expect(planningEstTermine(PLAN_TERMINE, '2026-06-25')).toBe(true);
  });

  it('calculerBilanPlanning calcule correctement les métriques des 3 phases', () => {
    const bilan = calculerBilanPlanning(PLAN_TERMINE);
    expect(bilan.termine).toBe(true);
    expect(bilan.totalSeances).toBe(3);
    expect(bilan.seancesFaites).toBe(3);
    expect(bilan.tauxReussite).toBe(100);
    expect(bilan.apprentissage.seancesFaites).toBe(1);
    expect(bilan.annales.seancesFaites).toBe(1);
    expect(bilan.revisionFinale.seancesFaites).toBe(1);
  });

  it('affiche le récapitulatif avec les 3 zones et les boutons d’action', async () => {
    await monter(<PlanningTermine />);

    expect(await screen.findByText('Programme terminé !')).toBeTruthy();
    expect(screen.getByText('Zone d’apprentissage')).toBeTruthy();
    expect(screen.getByText('Zone des annales')).toBeTruthy();
    expect(screen.getByText('Dernière révision')).toBeTruthy();

    const btnNouveau = screen.getByRole('button', { name: 'Créer un nouveau planning' });
    expect(btnNouveau).toBeTruthy();
    await fireEvent.press(btnNouveau);
    expect(router.replace).toHaveBeenCalledWith('/planning');
  });

  it('le retour matériel Android quitte proprement sans boucler', async () => {
    let handler: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, f) => {
      handler = f;
      return { remove: jest.fn() };
    });

    await monter(<PlanningTermine />);

    await screen.findByText('Programme terminé !');
    expect(handler).toBeDefined();
    handler?.({} as Parameters<NonNullable<typeof handler>>[0]);
    expect(router.replace).toHaveBeenCalledWith('/');
  });
});
