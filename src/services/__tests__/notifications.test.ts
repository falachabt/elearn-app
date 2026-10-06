import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  appliquerEvenement,
  categorieDe,
  compterNonLues,
  delaiEcoule,
  depuisLigne,
  destinationDe,
  ecrireReglagesNotifications,
  garderNotifications,
  grouperParJour,
  libellePastille,
  lireNotifications,
  lireNotificationsGardees,
  lireReglagesNotifications,
  LIMITE_NOTIFICATIONS,
  marquerLue,
  REGLAGES_PAR_DEFAUT,
  suivreNotifications,
  toutMarquerLu,
  type Notification,
} from '../notifications';

const ligne = (id: string, extra: Record<string, unknown> = {}) => ({
  id, type: 'post_comment', title: `Titre ${id}`, body: `Corps ${id}`, data: {}, read_at: null as string | null, created_at: '2026-10-06T10:00:00Z', ...extra,
});
const notif = (id: string, extra: Partial<Notification> = {}): Notification => ({ ...depuisLigne(ligne(id)), ...extra });

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('depuisLigne', () => {
  it('range la ligne du serveur et lit read_at comme lue', () => {
    expect(depuisLigne(ligne('a', { read_at: '2026-10-06T11:00:00Z' }))).toEqual({
      id: 'a', type: 'post_comment', titre: 'Titre a', corps: 'Corps a', data: {}, lue: true, creeLe: '2026-10-06T10:00:00Z',
    });
    expect(depuisLigne(ligne('b')).lue).toBe(false);
  });

  it('remplace des données absentes ou mal formées par un objet vide', () => {
    expect(depuisLigne(ligne('c', { data: null })).data).toEqual({});
    expect(depuisLigne(ligne('d', { data: ['x'] })).data).toEqual({});
    expect(depuisLigne(ligne('e', { data: { screen: '/credits' } })).data).toEqual({ screen: '/credits' });
  });
});

describe('lectures et écritures serveur', () => {
  it('lit les plus récentes d’abord, avec la limite', async () => {
    const limit = jest.fn(async () => ({ data: [ligne('a'), ligne('b', { read_at: '2026-10-06T11:00:00Z' })], error: null }));
    const order = jest.fn(() => ({ limit }));
    const select = jest.fn(() => ({ order }));
    const client = { from: jest.fn(() => ({ select })), rpc: jest.fn() };
    const liste = await lireNotifications(client as never);
    expect(client.from).toHaveBeenCalledWith('notifications');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(limit).toHaveBeenCalledWith(LIMITE_NOTIFICATIONS);
    expect(liste.map((n) => [n.id, n.lue])).toEqual([['a', false], ['b', true]]);
  });

  it('remonte l’erreur du serveur', async () => {
    const client = { from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: null, error: new Error('hors ligne') }) }) }) }), rpc: jest.fn() };
    await expect(lireNotifications(client as never)).rejects.toThrow('hors ligne');
  });

  it('compte les non lues par la fonction du serveur', async () => {
    const rpc = jest.fn(async () => ({ data: 4, error: null }));
    expect(await compterNonLues({ rpc, from: jest.fn() } as never)).toBe(4);
    expect(rpc).toHaveBeenCalledWith('unread_notifications_count');
    expect(await compterNonLues({ rpc: async () => ({ data: null, error: null }), from: jest.fn() } as never)).toBe(0);
  });

  it('marque une notification lue par la fonction serveur (la table n’accepte pas d’update direct)', async () => {
    const rpc = jest.fn(async () => ({ data: true, error: null }));
    const from = jest.fn();
    await marquerLue({ from, rpc } as never, 'n1');
    expect(rpc).toHaveBeenCalledWith('mark_notification_read', { p_notification_id: 'n1' });
    expect(from).not.toHaveBeenCalled();
  });

  it('remonte l’échec du serveur pour que l’écran revienne à l’état réel', async () => {
    await expect(marquerLue({ rpc: async () => ({ data: null, error: new Error('refusé') }), from: jest.fn() } as never, 'n1')).rejects.toThrow('refusé');
  });


  it('« tout lire » renvoie le nombre de notifications marquées', async () => {
    const rpc = jest.fn(async () => ({ data: 3, error: null }));
    expect(await toutMarquerLu({ rpc, from: jest.fn() } as never)).toBe(3);
    expect(rpc).toHaveBeenCalledWith('mark_all_notifications_read');
    await expect(toutMarquerLu({ rpc: async () => ({ data: null, error: new Error('x') }), from: jest.fn() } as never)).rejects.toThrow('x');
  });
});

describe('pastille', () => {
  it('affiche le nombre jusqu’à 9, puis « 9+ »', () => {
    expect(libellePastille(0)).toBe('0');
    expect(libellePastille(9)).toBe('9');
    expect(libellePastille(10)).toBe('9+');
    expect(libellePastille(120)).toBe('9+');
    expect(libellePastille(-2)).toBe('0');
  });
});

describe('copie sur l’appareil', () => {
  it('garde la liste de CET élève et pas celle d’un autre', async () => {
    await garderNotifications('u1', [notif('a'), notif('b')]);
    expect((await lireNotificationsGardees('u1'))?.map((n) => n.id)).toEqual(['a', 'b']);
    expect(await lireNotificationsGardees('u2')).toBeNull();
  });

  it('limite la copie et ignore une copie illisible', async () => {
    await garderNotifications('u1', Array.from({ length: LIMITE_NOTIFICATIONS + 10 }, (_, i) => notif(`n${i}`)));
    expect((await lireNotificationsGardees('u1'))?.length).toBe(LIMITE_NOTIFICATIONS);
    await AsyncStorage.setItem('notifications.liste', '{pas du json');
    expect(await lireNotificationsGardees('u1')).toBeNull();
  });
});

describe('temps réel', () => {
  it('écoute le filtre de l’élève, transmet les évènements et se désabonne', () => {
    let rappel: ((c: unknown) => void) | null = null;
    const canal: { on: jest.Mock; subscribe: jest.Mock } = {
      on: jest.fn((_t: string, _f: unknown, cb: (c: unknown) => void) => {
        rappel = cb;
        return canal;
      }),
      subscribe: jest.fn(() => canal),
    };
    const client = { channel: jest.fn(() => canal), removeChannel: jest.fn() };
    const surEvenement = jest.fn();
    const arreter = suivreNotifications(client as never, 'u1', surEvenement);
    expect(client.channel).toHaveBeenCalledWith('notifications:u1');
    expect(canal.on).toHaveBeenCalledWith('postgres_changes', expect.objectContaining({ table: 'notifications', filter: 'user_id=eq.u1' }), expect.any(Function));
    rappel!({ eventType: 'INSERT', new: ligne('x'), old: {} });
    expect(surEvenement).toHaveBeenCalledWith({ type: 'INSERT', ligne: expect.objectContaining({ id: 'x' }), ancienId: null });
    rappel!({ eventType: 'DELETE', new: {}, old: { id: 'y' } });
    expect(surEvenement).toHaveBeenLastCalledWith({ type: 'DELETE', ligne: null, ancienId: 'y' });
    arreter();
    expect(client.removeChannel).toHaveBeenCalledWith(canal);
  });

  it('applique les évènements à la liste', () => {
    const liste = [notif('a'), notif('b')];
    expect(appliquerEvenement(liste, { type: 'INSERT', ligne: ligne('c'), ancienId: null }).map((n) => n.id)).toEqual(['c', 'a', 'b']);
    const maj = appliquerEvenement(liste, { type: 'UPDATE', ligne: ligne('a', { read_at: '2026-10-06T12:00:00Z' }), ancienId: null });
    expect(maj.map((n) => [n.id, n.lue])).toEqual([['a', true], ['b', false]]);
    expect(appliquerEvenement(liste, { type: 'DELETE', ligne: null, ancienId: 'a' }).map((n) => n.id)).toEqual(['b']);
    expect(appliquerEvenement(liste, { type: 'DELETE', ligne: null, ancienId: null })).toBe(liste);
    expect(appliquerEvenement(liste, { type: 'INSERT', ligne: null, ancienId: null })).toBe(liste);
  });

  it('ne dépasse jamais la limite de la liste', () => {
    const pleine = Array.from({ length: LIMITE_NOTIFICATIONS }, (_, i) => notif(`n${i}`));
    const apres = appliquerEvenement(pleine, { type: 'INSERT', ligne: ligne('nouvelle'), ancienId: null });
    expect(apres).toHaveLength(LIMITE_NOTIFICATIONS);
    expect(apres[0].id).toBe('nouvelle');
  });
});

describe('groupes et délais', () => {
  const maintenant = new Date(2026, 9, 6, 15, 0, 0);

  it('sépare « Aujourd’hui » de « Plus tôt » et n’affiche pas un groupe vide', () => {
    const liste = [notif('a', { creeLe: new Date(2026, 9, 6, 9, 0).toISOString() }), notif('b', { creeLe: new Date(2026, 9, 5, 22, 0).toISOString() })];
    expect(grouperParJour(liste, maintenant).map((g) => [g.cle, g.notifications.map((n) => n.id)])).toEqual([['aujourdhui', ['a']], ['plusTot', ['b']]]);
    expect(grouperParJour([liste[1]], maintenant).map((g) => g.cle)).toEqual(['plusTot']);
    expect(grouperParJour([], maintenant)).toEqual([]);
  });

  it('exprime le délai écoulé', () => {
    const il = (minutes: number) => new Date(maintenant.getTime() - minutes * 60000).toISOString();
    expect(delaiEcoule(il(0), maintenant)).toEqual({ unite: 'maintenant', n: 0 });
    expect(delaiEcoule(il(10), maintenant)).toEqual({ unite: 'minutes', n: 10 });
    expect(delaiEcoule(il(125), maintenant)).toEqual({ unite: 'heures', n: 2 });
    expect(delaiEcoule(il(60 * 24 * 3 + 30), maintenant)).toEqual({ unite: 'jours', n: 3 });
    expect(delaiEcoule(new Date(maintenant.getTime() + 60000).toISOString(), maintenant).unite).toBe('maintenant');
  });
});

describe('catégories et destinations', () => {
  it('range chaque type dans la catégorie du serveur', () => {
    expect(['post_comment', 'post_reply', 'mention', 'post_like', 'profile_like'].map(categorieDe)).toEqual(Array(5).fill('answers'));
    expect(categorieDe('poll_revealed')).toBe('polls');
    expect(['credits_refilled', 'referral', 'reward'].map(categorieDe)).toEqual(['credits', 'credits', 'credits']);
    expect(categorieDe('study_reminder')).toBe('reminders');
    expect(categorieDe('marketing')).toBe('marketing');
    expect(categorieDe('payment_confirmed')).toBeNull();
    expect(categorieDe('admin_message')).toBeNull();
  });

  it('ouvre la question quand le serveur donne son identifiant', () => {
    expect(destinationDe('post_reply', { post_id: 'q1' })).toEqual({ pathname: '/question', params: { id: 'q1' } });
    expect(destinationDe('poll_revealed', { post_id: 'q2', screen: '/credits' })).toEqual({ pathname: '/question', params: { id: 'q2' } });
  });

  it('un paiement confirmé ouvre ce paiement quand la notification porte son identifiant, sinon la liste', () => {
    expect(destinationDe('payment_confirmed', { order_id: 'o-1', receipt_no: 'R1' })).toEqual({ pathname: '/paiements/[id]', params: { id: 'o-1' } });
    expect(destinationDe('payment_confirmed', { order_id: 'o-1', screen: '/moi' })).toEqual({ pathname: '/paiements/[id]', params: { id: 'o-1' } });
    expect(destinationDe('payment_confirmed', undefined)).toEqual({ pathname: '/paiements' });
  });

  it('retombe sur l’écran donné par le serveur, puis sur celui de la catégorie', () => {
    expect(destinationDe('reward', { screen: '/parrainage/recompenses' })).toEqual({ pathname: '/parrainage/recompenses' });
    expect(destinationDe('post_comment', {})).toEqual({ pathname: '/questions' });
    expect(destinationDe('credits_refilled', { screen: '/' })).toEqual({ pathname: '/moi' });
    expect(destinationDe('reward', { screen: '/' })).toEqual({ pathname: '/credits' });
    expect(destinationDe('referral', undefined)).toEqual({ pathname: '/parrainage' });
    expect(destinationDe('payment_confirmed', {})).toEqual({ pathname: '/paiements' });
    expect(destinationDe('payment_confirmed', { screen: '/moi', order_id: '' })).toEqual({ pathname: '/paiements' });
    expect(destinationDe('pass_ending', undefined)).toEqual({ pathname: '/moi' });
  });

  it('ne suit jamais une destination qui n’est pas un chemin interne', () => {
    expect(destinationDe('admin_message', { screen: 'https://exemple.com' })).toEqual({ pathname: '/' });
    expect(destinationDe('inconnu', { screen: 42 })).toEqual({ pathname: '/' });
    expect(destinationDe('post_comment', { post_id: '' })).toEqual({ pathname: '/questions' });
  });
});

describe('réglages', () => {
  it('lit la ligne renvoyée par le serveur (objet ou tableau)', async () => {
    const l = { enabled: false, answers: true, polls: false, credits: true, reminders: false, reminder_hour: 20, reminder_minute: 30 };
    const attendu = { enabled: false, answers: true, polls: false, credits: true, reminders: false, reminderHour: 20, reminderMinute: 30 };
    expect(await lireReglagesNotifications({ rpc: async () => ({ data: [l], error: null }), from: jest.fn() } as never)).toEqual(attendu);
    expect(await lireReglagesNotifications({ rpc: async () => ({ data: l, error: null }), from: jest.fn() } as never)).toEqual(attendu);
  });

  it('prend les valeurs par défaut sans ligne, et remonte l’erreur', async () => {
    expect(await lireReglagesNotifications({ rpc: async () => ({ data: [], error: null }), from: jest.fn() } as never)).toEqual(REGLAGES_PAR_DEFAUT);
    await expect(lireReglagesNotifications({ rpc: async () => ({ data: null, error: new Error('x') }), from: jest.fn() } as never)).rejects.toThrow('x');
  });

  it('n’envoie que ce qui change : le reste part à null, donc inchangé', async () => {
    const rpc = jest.fn(async () => ({ error: null }));
    await ecrireReglagesNotifications({ rpc, from: jest.fn() } as never, { polls: false });
    expect(rpc).toHaveBeenCalledWith('set_notification_preferences', {
      p_enabled: null, p_answers: null, p_polls: false, p_credits: null, p_reminders: null, p_reminder_hour: null, p_reminder_minute: null,
    });
    await ecrireReglagesNotifications({ rpc, from: jest.fn() } as never, { reminderHour: 0, reminderMinute: 0, enabled: false });
    expect(rpc).toHaveBeenLastCalledWith('set_notification_preferences', expect.objectContaining({ p_enabled: false, p_reminder_hour: 0, p_reminder_minute: 0 }));
  });

  it('remonte l’erreur d’écriture', async () => {
    await expect(ecrireReglagesNotifications({ rpc: async () => ({ error: new Error('refusé') }), from: jest.fn() } as never, { enabled: true })).rejects.toThrow('refusé');
  });
});
