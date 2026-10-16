import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { definirApi } from '@/services/certification/api';
import { creerApiFausse, STATS_VIDE } from '@/services/certification/__tests__/apiFausse';
import { JOUR } from '@/services/certification/__tests__/fixturesRevision';
import { definirDernierContactPourTest } from '@/services/connectivite';
import type { EtatGains, Stats } from '@/services/certification/types';
import { enregistrerProfil } from '@/services/profil';

import { GagnerToeic } from '../GagnerToeic';
import { MoiToeic } from '../MoiToeic';
import { StatistiquesToeic } from '../StatistiquesToeic';
import { monter } from './harnais';

const t = fr.certification;

let mockSolde: Record<string, unknown> = {};
const mockRafraichir = jest.fn();
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
jest.mock('@/session/CreditsProvider', () => ({
  useCredits: () => ({ solde: mockSolde, reglages: { bienvenue: 40, invite: 5, recharge: 25 }, couts: {}, depenser: jest.fn(), rafraichir: (...a: unknown[]) => mockRafraichir(...a) }),
}));

const HORS_LIGNE = { doNotFake: ['setTimeout', 'setInterval', 'setImmediate', 'clearTimeout', 'clearInterval', 'nextTick', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame'] as ('setTimeout' | 'setInterval' | 'setImmediate' | 'clearTimeout' | 'clearInterval' | 'nextTick' | 'queueMicrotask' | 'requestAnimationFrame' | 'cancelAnimationFrame')[] };

const PARTIES: Stats['parties'] = [1, 2, 3, 4, 5, 6, 7].map((partie) => ({
  partie, repondues: partie === 7 ? 0 : 12, bonnes: partie === 7 ? 0 : 9, taux: partie === 7 ? null : 0.75, maitrise: partie === 5 ? 0.25 : partie === 7 ? 0 : 0.8, reponsesMaitrise: 12,
  etat: partie === 5 ? 'fragile' : partie === 7 ? 'pas_commencee' : 'acquise',
}));
const STATS_OK = (periode: Stats['periode'] = 7): Stats => ({
  status: 'ok', periode, reponsesTotal: 84, score: { estime: true, min: 650, max: 730 },
  barres: [{ fin: '2026-10-05', min: 600, max: 700, milieu: 650 }, { fin: '2026-10-12', min: 650, max: 730, milieu: 690 }],
  tendance: 'up', parties: PARTIES, minutesSeances: 95, minutesLecture: 22, joursSur7: 4, seances: 6, serieJours: 3,
  mots: { aRevoir: 5, enCours: 4, connus: 9 }, calculeLe: '2026-10-16T09:00:00Z',
});

let fausse: ReturnType<typeof creerApiFausse>;
const installer = (options: Parameters<typeof creerApiFausse>[0] = {}) => {
  fausse = creerApiFausse(options);
  definirApi(fausse.api);
};

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date(`${JOUR}T10:00:00`), ...HORS_LIGNE });
  jest.clearAllMocks();
  mockSolde = { illimite: false, total: 12, semaine: 0, recompenses: 0, recharge: 25, rechargeHebdo: true, prochaineRecharge: '2026-10-19T00:00:00Z', illimiteJusqua: null, expirationRecompenses: null };
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'certification', exam: 'toeic', pays: 'CM', termine: true });
  installer({ stats: STATS_OK() });
});
afterEach(() => {
  definirDernierContactPourTest(null);
  definirApi(null);
  jest.useRealTimers();
});

describe('ST1 · Statistiques', () => {
  it('score estimé, tendance, maîtrise par partie, temps, régularité et mots', async () => {
    await monter(<StatistiquesToeic />);
    expect(await screen.findByText('650 à 730 sur 990')).toBeTruthy();
    expect(screen.getByText(t.stats.tendanceHausse)).toBeTruthy();
    expect(screen.getByText(t.stats.mention)).toBeTruthy();
    expect(screen.getByText(t.stats.partie.replace('{{n}}', '5'))).toBeTruthy();
    expect(screen.getAllByText(t.resultat.etats.fragile).length).toBe(1);
    expect(screen.getAllByText(t.resultat.etats.acquise).length).toBe(5);
    expect(screen.getByText(t.stats.partieAucune)).toBeTruthy();
    expect(screen.getByText(t.stats.seancesAide.replace('{{min}}', '95'))).toBeTruthy();
    expect(screen.getByText(t.stats.lectureAide.replace('{{min}}', '22'))).toBeTruthy();
    expect(screen.getByText(t.stats.jours.replace('{{n}}', '4'))).toBeTruthy();
    expect(screen.getByText(t.stats.serie.replace('{{n}}', '3'))).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByLabelText(t.stats.graphique)).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('cert_stats_viewed', { periode: 's7' });
    expect(suivre).toHaveBeenCalledWith('cert_mastery_viewed', { ecran: 'statistiques' });
  });

  it('change de période : un seul appel par période et un évènement', async () => {
    await monter(<StatistiquesToeic />);
    await screen.findByText('650 à 730 sur 990');
    await fireEvent.press(screen.getByText(t.stats.periodes.s30));
    await waitFor(() => expect(fausse.appels.stats).toEqual([7, 30]));
    expect(suivre).toHaveBeenCalledWith('cert_stats_period_changed', { periode: 's30' });
    await waitFor(() => expect(suivre).toHaveBeenCalledWith('cert_stats_viewed', { periode: 's30' }));
  });

  it('ouvre une partie, l’historique et le carnet', async () => {
    await monter(<StatistiquesToeic />);
    await fireEvent.press(await screen.findByText(t.stats.partie.replace('{{n}}', '5')));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/certification/partie', params: { n: '5' } });
    await fireEvent.press(screen.getByText(t.stats.historique));
    expect(router.push).toHaveBeenCalledWith('/certification/historique');
  });

  it('ST2 · vide : invite à commencer une séance', async () => {
    installer({ stats: STATS_VIDE(7) });
    await monter(<StatistiquesToeic />);
    expect(await screen.findByText(`${t.stats.vide.titre}. ${t.stats.vide.texte}`)).toBeTruthy();
    await fireEvent.press(screen.getByText(t.stats.vide.action));
    expect(router.push).toHaveBeenCalledWith('/certification/seance');
  });

  it('ST3 · première semaine : des données, pas de tendance', async () => {
    installer({ stats: { ...STATS_OK(), status: 'first_week', tendance: null, barres: [] } });
    await monter(<StatistiquesToeic />);
    expect(await screen.findByText(t.stats.premiere.titre)).toBeTruthy();
    expect(screen.getByText('650 à 730 sur 990')).toBeTruthy();
    expect(screen.queryByText(t.stats.tendanceHausse)).toBeNull();
    expect(screen.queryByLabelText(t.stats.graphique)).toBeNull();
  });

  it('invité : invitation à créer un compte', async () => {
    installer({ stats: { ...STATS_VIDE(7), status: 'guest' } });
    await monter(<StatistiquesToeic />);
    expect(await screen.findByText(t.stats.invite.titre)).toBeTruthy();
    await fireEvent.press(screen.getByText(t.stats.invite.action));
    expect(router.push).toHaveBeenCalledWith('/compte/creer');
  });

  it('ST4 · hors ligne : la dernière réponse est servie avec sa date de calcul', async () => {
    await monter(<StatistiquesToeic />);
    await screen.findByText('650 à 730 sur 990');
    installer({ stats: 'echec' });
    await monter(<StatistiquesToeic />);
    expect(await screen.findByText(t.stats.horsLigne.replace('{{date}}', '16 octobre'))).toBeTruthy();
    expect(screen.getByText('650 à 730 sur 990')).toBeTruthy();
  });

  it('copie de plus de 7 jours : non servie', async () => {
    await monter(<StatistiquesToeic />);
    await screen.findByText('650 à 730 sur 990');
    installer({ stats: 'echec' });
    definirDernierContactPourTest(Date.now() - 8 * 24 * 3600 * 1000);
    await monter(<StatistiquesToeic />);
    expect(await screen.findByText(t.stats.expire.titre)).toBeTruthy();
    expect(screen.queryByText('650 à 730 sur 990')).toBeNull();
  });

  it('sans copie ni réseau : message d’erreur et nouvel essai', async () => {
    installer({ stats: 'echec' });
    await monter(<StatistiquesToeic />);
    expect(await screen.findByText(t.stats.erreurTitre)).toBeTruthy();
    installer({ stats: STATS_OK() });
    await fireEvent.press(screen.getByText(t.reessayer));
    expect(await screen.findByText('650 à 730 sur 990')).toBeTruthy();
  });

  it('thème sombre', async () => {
    await monter(<StatistiquesToeic />, 'sombre');
    expect(await screen.findByText('650 à 730 sur 990')).toBeTruthy();
  });
});

describe('G1 · Gagner des crédits', () => {
  const GAINS: EtatGains = {
    plafond: 15, gagneSemaine: 12, serie: 4,
    gains: [
      { code: 'session_done', montant: 2, progression: 3, cible: 7, deja: false },
      { code: 'streak_7', montant: 10, progression: 4, cible: 7 },
      { code: 'goal_reached', montant: 20, deja: true },
      { code: 'mini_first', montant: 3, deja: false },
    ],
  };

  it('affiche les quatre gains avec leurs montants du serveur et le plafond de la semaine', async () => {
    installer({ gains: GAINS });
    await monter(<GagnerToeic />);
    expect(await screen.findByText(t.gagner.intro.replace('{{plafond}}', '15'))).toBeTruthy();
    expect(screen.getByText(t.gagner.sessionDoneAide.replace('{{n}}', '2').replace('{{p}}', '3').replace('{{c}}', '7'))).toBeTruthy();
    expect(screen.getByText(t.gagner.streakAide.replace('{{n}}', '10').replace('{{p}}', '4').replace('{{c}}', '7'))).toBeTruthy();
    expect(screen.getByText(t.gagner.goalAide.replace('{{n}}', '20'))).toBeTruthy();
    expect(screen.getByText(t.gagner.miniAide.replace('{{n}}', '3'))).toBeTruthy();
    expect(screen.getByText(t.gagner.plafondLigne.replace('{{g}}', '12').replace('{{p}}', '15'))).toBeTruthy();
    expect(screen.getByText(t.gagner.expire.replace('{{n}}', '30'))).toBeTruthy();
    // Un gain déjà obtenu n’a pas de bouton ; « 7 jours de suite » n’est pas encore atteint.
    expect(screen.getAllByText(t.gagner.reclamer)).toHaveLength(3);
    expect(screen.getByText(t.gagner.fait)).toBeTruthy();
    expect(screen.getByRole('button', { name: t.gagner.reclamer, disabled: true })).toBeTruthy();
  });

  it('récupère un gain : le serveur crédite, le solde est relu, un évènement part', async () => {
    installer({ gains: GAINS, reclamation: { status: 'granted', montant: 3, gagneSemaine: 15, plafond: 15 } });
    await monter(<GagnerToeic />);
    const boutons = await screen.findAllByText(t.gagner.reclamer);
    await fireEvent.press(boutons[boutons.length - 1]);
    expect(await screen.findByText(t.gagner.obtenu.replace('{{n}}', '3'))).toBeTruthy();
    expect(fausse.appels.gainsReclames).toEqual(['mini_first']);
    expect(mockRafraichir).toHaveBeenCalled();
    expect(suivre).toHaveBeenCalledWith('cert_earn_claimed', { code: 'mini_first', statut: 'granted' });
  });

  it.each([
    ['cap_reached', t.gagner.plafondAtteint],
    ['not_eligible', t.gagner.pasEncore],
    ['already', t.gagner.dejaObtenu],
    ['account_required', t.gagner.compte],
  ] as const)('réponse « %s » du serveur : message clair', async (status, texte) => {
    installer({ gains: GAINS, reclamation: { status } });
    await monter(<GagnerToeic />);
    await fireEvent.press((await screen.findAllByText(t.gagner.reclamer))[0]);
    expect(await screen.findByText(texte)).toBeTruthy();
    expect(mockRafraichir).not.toHaveBeenCalled();
  });

  it('gains injoignables : message et nouvel essai', async () => {
    installer({ gains: 'echec' });
    await monter(<GagnerToeic />);
    expect(await screen.findByText(t.gagner.erreurTitre)).toBeTruthy();
  });

  it('thème sombre', async () => {
    installer({ gains: GAINS });
    await monter(<GagnerToeic />, 'sombre');
    expect(await screen.findByText(t.gagner.intro.replace('{{plafond}}', '15'))).toBeTruthy();
  });
});

