import { router } from 'expo-router';

import { suivre } from '../analytics';
import { marquerLue } from '../notifications';
import { suivreOuvertures } from '../rappels';
import { sAbonnerFeuilleRecharge, type DemandeFeuilleRecharge } from '../rechargePass';

let mockRappel: ((r: unknown) => void) | null = null;
const mockRetirer = jest.fn();

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn((cb: (r: unknown) => void) => {
    mockRappel = cb;
    return { remove: mockRetirer };
  }),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../analytics', () => ({ suivre: jest.fn(), definirProprietesUtilisateur: jest.fn() }));
jest.mock('../supabase', () => ({ getSupabase: () => ({ id: 'client' }) }));
jest.mock('../notifications', () => ({
  ...jest.requireActual('../notifications'),
  marquerLue: jest.fn(async () => {}),
}));

/** Simule le toucher d'une notification push du serveur (type et données de la ligne, plus son identifiant). */
const toucher = (data: Record<string, unknown> | undefined) => mockRappel?.({ notification: { request: { content: { data } } } });

beforeEach(() => {
  jest.clearAllMocks();
  mockRappel = null;
  suivreOuvertures();
});

describe('toucher d’une notification push du serveur', () => {
  it('ouvre la question d’une réponse et marque la notification lue', () => {
    toucher({ type: 'post_reply', post_id: 'q7', notificationId: 'n1' });
    expect(router.push).toHaveBeenCalledWith({ pathname: '/question', params: { id: 'q7' } });
    expect(marquerLue).toHaveBeenCalledWith({ id: 'client' }, 'n1');
    expect(suivre).toHaveBeenCalledWith('notification_opened', { type: 'post_reply' });
  });

  it('retombe sur l’écran de la catégorie quand le serveur ne donne pas de question', () => {
    toucher({ type: 'poll_revealed', notificationId: 'n2' });
    expect(router.push).toHaveBeenCalledWith('/questions');
    toucher({ type: 'reward', notificationId: 'n3' });
    expect(router.push).toHaveBeenLastCalledWith('/credits');
  });

  it('une correction prête du serveur ouvre cette correction et se marque lue', () => {
    toucher({ type: 'photo_ready', notificationId: 'n5', correction_id: 'c-1' });
    expect(router.push).toHaveBeenCalledWith({ pathname: '/photo', params: { id: 'c-1' } });
    expect(marquerLue).toHaveBeenCalledWith(expect.anything(), 'n5');
  });

  it('un paiement confirmé sans identifiant de commande ouvre la liste des paiements', () => {
    toucher({ type: 'payment_confirmed', notificationId: 'n4' });
    expect(router.push).toHaveBeenCalledWith('/paiements');
  });

  it('un paiement confirmé avec son identifiant ouvre ce paiement', () => {
    toucher({ type: 'payment_confirmed', notificationId: 'n4', order_id: 'o-9' });
    expect(router.push).toHaveBeenCalledWith({ pathname: '/paiements/[id]', params: { id: 'o-9' } });
  });

  it('une alerte de fin de Pass sans feuille montée retombe sur les offres, jamais « Mes paiements » (#124)', () => {
    toucher({ type: 'pass_ending', days_left: 3, notificationId: 'n6' });
    expect(router.push).toHaveBeenCalledWith({ pathname: '/offres', params: { declencheur: 'recharge-pass' } });
    expect(router.push).not.toHaveBeenCalledWith('/paiements');
    expect(marquerLue).toHaveBeenCalledWith({ id: 'client' }, 'n6');
    expect(suivre).toHaveBeenCalledWith('notification_opened', { type: 'pass_ending' });
  });

  it('une alerte de fin de Pass demande la feuille « recharger le Pass » quand elle est montée, sans naviguer (#124)', () => {
    const demandes: DemandeFeuilleRecharge[] = [];
    const arreter = sAbonnerFeuilleRecharge((d) => demandes.push(d));
    try {
      toucher({ type: 'pass_ending', days_left: 8, notificationId: 'n8' });
      expect(demandes).toEqual([{ joursRestants: 8 }]);
      expect(router.push).not.toHaveBeenCalled();
      expect(marquerLue).toHaveBeenCalledWith({ id: 'client' }, 'n8');
    } finally {
      arreter();
    }
  });

  it('le résumé hebdomadaire ouvre la page Ma semaine de cette semaine', () => {
    toucher({ type: 'weekly_summary', week_start: '2026-09-28', missions: 4, notificationId: 'n7' });
    expect(router.push).toHaveBeenCalledWith({ pathname: '/ma-semaine', params: { semaine: '2026-09-28', source: 'push' } });
    expect(marquerLue).toHaveBeenCalledWith({ id: 'client' }, 'n7');
  });

  it('sans identifiant de notification, ouvre l’écran sans rien marquer', () => {
    toucher({ type: 'referral' });
    expect(router.push).toHaveBeenCalledWith('/parrainage');
    expect(marquerLue).not.toHaveBeenCalled();
  });

  it('un échec du marquage ne bloque pas l’ouverture', async () => {
    (marquerLue as jest.Mock).mockRejectedValueOnce(new Error('hors ligne'));
    expect(() => toucher({ type: 'post_comment', notificationId: 'n5' })).not.toThrow();
    expect(router.push).toHaveBeenCalledWith('/questions');
    await Promise.resolve();
  });

  it('ne fait rien sans type et ne casse pas les anciens types locaux', () => {
    toucher(undefined);
    toucher({});
    expect(router.push).not.toHaveBeenCalled();
    toucher({ type: 'mission' });
    expect(router.push).toHaveBeenCalledWith('/');
    toucher({ type: 'feed_reply' });
    expect(router.push).toHaveBeenLastCalledWith('/questions');
    expect(marquerLue).not.toHaveBeenCalled();
  });

  it('se désabonne', () => {
    const arreter = suivreOuvertures();
    arreter();
    expect(mockRetirer).toHaveBeenCalled();
  });
});
