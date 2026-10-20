import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { changerLangue } from '@/i18n';
import { en } from '@/i18n/en';
import { fr } from '@/i18n/fr';
import { definirBrouillon, lireBrouillon, PREFERENCE_TEMPS_DEFAUT, type PreferenceTemps, type Session } from '@/services/travailSujet';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { AnalyseTravail } from '../travail/AnalyseTravail';
import { ChoixTemps } from '../travail/ChoixTemps';
import { ListeSessions } from '../travail/ListeSessions';
import { OrdreFeuilles } from '../travail/OrdreFeuilles';
import { SessionTravail } from '../travail/SessionTravail';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/session/CreditsProvider', () => ({
  useCredits: () => ({ solde: null, couts: { ai_question: 5 }, depenser: jest.fn(), rafraichir: async () => {}, depensesEnAttente: 0 }),
}));
jest.mock('@/session/SessionProvider', () => ({ useSessionPrete: () => 'u1', useSession: () => ({ session: { user: { id: 'u1', is_anonymous: false } } }) }));

const mockEnvoyer = jest.fn();
const mockLireSession = jest.fn();
const mockUrls = jest.fn();
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({}) }));
jest.mock('@/services/travailSujet', () => {
  const reel = jest.requireActual('@/services/travailSujet');
  return {
    ...reel,
    envoyerTravail: (...a: unknown[]) => mockEnvoyer(...a),
    preparerFeuille: jest.fn(async () => 'AAAA'),
    lireSession: (...a: unknown[]) => mockLireSession(...a),
    lireUrlsFeuilles: (...a: unknown[]) => mockUrls(...a),
  };
});

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (el: React.ReactElement) => render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair">{el}</ThemeProvider></SafeAreaProvider>);
const T = { fr, en };

const feuille = (n: number) => ({ id: `f${n}`, uri: `file:///${n}.jpg`, largeur: 100, hauteur: 200 });
const resultat = { questions: [{ n: '1', titre: 'Dérivée', points: 2, max: 3, commentaire: 'Presque' }, { n: '2', titre: 'Limite', points: 0, max: 2, commentaire: 'Revoir' }], resume: 'Bon début' };
const session = (extra: Partial<Session> = {}): Session => ({ id: 's1', statut: 'done', score: 12, total: 20, feuilles: 2, tempsS: 3600, date: '2026-10-20T10:00:00Z', resultat, feuillesEffacees: false, ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  definirBrouillon(null);
});
afterAll(() => changerLangue('fr'));

describe.each(['fr', 'en'] as const)('anciens sujets, parcours du travail (%s)', (langue) => {
  const x = T[langue];
  beforeEach(() => act(() => changerLangue(langue)));

  describe('ChoixTemps', () => {
    const Hote = ({ dureeMin, depart = PREFERENCE_TEMPS_DEFAUT, surChange }: { dureeMin: number | null; depart?: PreferenceTemps; surChange?: (p: PreferenceTemps) => void }) => {
      const [v, setV] = useState(depart);
      return <ChoixTemps valeur={v} dureeMin={dureeMin} onChange={(p) => { setV(p); surChange?.(p); }} />;
    };

    it('compte à rebours par défaut avec le temps conseillé ; passage au chrono libre', async () => {
      const surChange = jest.fn();
      await monter(<Hote dureeMin={180} surChange={surChange} />);
      expect(screen.getByRole('radio', { name: x.travail.tempsConseille })).toBeTruthy();
      await fireEvent.press(screen.getByRole('tab', { name: x.travail.tempsMesurer }));
      expect(surChange).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'libre' }));
      expect(screen.queryByRole('radio', { name: x.travail.tempsConseille })).toBeNull();
    });

    it('sans temps conseillé : seul « Mon temps » est proposé, minutes saisies', async () => {
      const surChange = jest.fn();
      await monter(<Hote dureeMin={null} surChange={surChange} depart={{ mode: 'compte', choix: 'perso', minutes: '' }} />);
      expect(screen.queryByRole('radio', { name: x.travail.tempsConseille })).toBeNull();
      await fireEvent.changeText(screen.getByLabelText(x.travail.tempsMinutes), '45');
      expect(surChange).toHaveBeenLastCalledWith({ mode: 'compte', choix: 'perso', minutes: '45' });
    });
  });

  describe('ListeSessions', () => {
    it('aucune session : message vide', async () => {
      await monter(<ListeSessions sessions={[]} erreur={false} kind="exam" reference="1" />);
      expect(screen.getByText(x.travail.sessionsVide)).toBeTruthy();
    });

    it('erreur de lecture : bannière', async () => {
      await monter(<ListeSessions sessions={null} erreur kind="exam" reference="1" />);
      expect(screen.getByText(x.travail.sessionsErreur)).toBeTruthy();
    });

    it('une session affiche sa note et s’ouvre', async () => {
      await monter(<ListeSessions sessions={[session()]} erreur={false} kind="exam" reference="1" />);
      expect(screen.getByText('12/20')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: /12\/20/ }));
      expect(router.push).toHaveBeenCalledWith({ pathname: '/annales/session', params: { id: 's1', kind: 'exam', ref: '1' } });
    });
  });

  describe('OrdreFeuilles', () => {
    beforeEach(() => definirBrouillon({ kind: 'exam', ref: '1', titre: 'Maths', matiere: null, tempsS: null, feuilles: [feuille(1), feuille(2), feuille(3)] }));

    it('monter, descendre et retirer changent l’ordre envoyé', async () => {
      await monter(<OrdreFeuilles />);
      await fireEvent.press(screen.getByRole('button', { name: x.travail.descendre.replace('{{n}}', '1') }));
      expect(lireBrouillon()?.feuilles.map((f) => f.id)).toEqual(['f2', 'f1', 'f3']);
      await fireEvent.press(screen.getByRole('button', { name: x.travail.monter.replace('{{n}}', '3') }));
      expect(lireBrouillon()?.feuilles.map((f) => f.id)).toEqual(['f2', 'f3', 'f1']);
      await fireEvent.press(screen.getByRole('button', { name: x.travail.retirer.replace('{{n}}', '2') }));
      expect(lireBrouillon()?.feuilles.map((f) => f.id)).toEqual(['f2', 'f1']);
    });

    it('le bouton d’envoi annonce le prix du serveur et ouvre l’analyse', async () => {
      await monter(<OrdreFeuilles />);
      const envoyer = screen.getByRole('button', { name: /5/ });
      await fireEvent.press(envoyer);
      expect(router.push).toHaveBeenCalledWith('/annales/analyse');
    });
  });

  describe('AnalyseTravail', () => {
    beforeEach(() => definirBrouillon({ kind: 'exam', ref: '1', titre: 'Maths', matiere: 'Maths', tempsS: 600, feuilles: [feuille(1), feuille(2)] }));

    it('succès : feuilles préparées dans l’ordre, brouillon vidé, session ouverte', async () => {
      mockEnvoyer.mockResolvedValue({ type: 'fin', id: 's9', score: 12, total: 20, resultat });
      await monter(<AnalyseTravail />);
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/annales/session', params: { id: 's9', kind: 'exam', ref: '1' } }));
      expect(mockEnvoyer.mock.calls[0][1]).toMatchObject({ kind: 'exam', ref: '1', pages: ['AAAA', 'AAAA'], tempsS: 600, matiere: 'Maths' });
      expect(lireBrouillon()).toBeNull();
    });

    it.each([
      ['illisible', { type: 'illisible', raison: 'flou' }, 'illisible'],
      ['hors-ligne', { type: 'hors-ligne' }, 'horsLigne'],
      ['quota', { type: 'quota' }, 'quota'],
      ['limite', { type: 'limite', minutes: 5 }, 'limite'],
      ['erreur', { type: 'erreur' }, 'erreurIA'],
    ] as const)('échec %s : message clair, le brouillon reste', async (_nom, issue, cle) => {
      mockEnvoyer.mockResolvedValue(issue);
      await monter(<AnalyseTravail />);
      await waitFor(() => expect(screen.getByText(x.travail[cle])).toBeTruthy());
      expect(lireBrouillon()?.feuilles).toHaveLength(2);
      expect(router.replace).not.toHaveBeenCalled();
    });

    it('sans feuilles : retour à l’ordre', async () => {
      definirBrouillon(null);
      await monter(<AnalyseTravail />);
      await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/annales/ordre'));
      expect(mockEnvoyer).not.toHaveBeenCalled();
    });
  });

  describe('SessionTravail', () => {
    beforeEach(() => {
      mockParams = { id: 's1', kind: 'exam', ref: '1' };
    });

    it('note, points par question et commentaire', async () => {
      mockLireSession.mockResolvedValue(session());
      await monter(<SessionTravail />);
      await waitFor(() => expect(screen.getByText('12/20')).toBeTruthy());
      expect(screen.getByText('2/3')).toBeTruthy();
      expect(screen.getByText('0/2')).toBeTruthy();
      expect(screen.getByText('Presque')).toBeTruthy();
      expect(screen.getByText('Bon début')).toBeTruthy();
    });

    it('session introuvable ou non terminée : état absent', async () => {
      mockLireSession.mockResolvedValue(session({ statut: 'pending' }));
      await monter(<SessionTravail />);
      await waitFor(() => expect(mockLireSession).toHaveBeenCalled());
      expect(screen.queryByText('12/20')).toBeNull();
    });

    it('erreur de lecture : pas de note affichée', async () => {
      mockLireSession.mockRejectedValue(new Error('x'));
      await monter(<SessionTravail />);
      await waitFor(() => expect(mockLireSession).toHaveBeenCalled());
      expect(screen.queryByText('12/20')).toBeNull();
    });
  });
});
