import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

import { suivre } from '../analytics';
import { appliquerTempsReel, CLE_APPAREIL, delaiJusqua, depenser, identifiantAppareil, lireCouts, lireSemaine, lireSolde, peutVoir, suivreSolde } from '../credits';

jest.mock('../analytics', () => ({ suivre: jest.fn() }));
jest.mock('expo-application', () => ({ getAndroidId: jest.fn(), getIosIdForVendorAsync: jest.fn() }));

const ligneSolde = {
  balance: 29,
  weekly_left: 25,
  reward_left: 4,
  weekly_amount: 25,
  next_refill_at: '2026-10-04T23:00:00Z',
  weekly_refill: true,
  unlimited: false,
  unlimited_until: null,
  next_reward_expiry: '2026-10-20T10:00:00Z',
};

function clientFaux(rpc: { data?: unknown; error?: unknown } = {}) {
  const canal = { on: jest.fn(), subscribe: jest.fn() };
  canal.on.mockReturnValue(canal);
  canal.subscribe.mockReturnValue(canal);
  return {
    rpc: jest.fn(async () => ({ data: rpc.data ?? null, error: rpc.error ?? null })),
    from: jest.fn(() => ({ select: jest.fn(async () => ({ data: [{ code: 'quiz_explanation', cost: 1 }, { code: 'exam_correction', cost: 5 }], error: null })) })),
    channel: jest.fn(() => canal),
    removeChannel: jest.fn(),
    canal,
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('crédits', () => {
  it('lit le solde avec l’empreinte de l’appareil', async () => {
    const c = clientFaux({ data: [ligneSolde] });
    const s = await lireSolde(c as never, 'android:abc');
    expect(c.rpc).toHaveBeenCalledWith('my_credits', { p_device: 'android:abc' });
    expect(s).toEqual({
      total: 29,
      semaine: 25,
      recompenses: 4,
      recharge: 25,
      prochaineRecharge: '2026-10-04T23:00:00Z',
      rechargeHebdo: true,
      illimite: false,
      illimiteJusqua: null,
      expirationRecompenses: '2026-10-20T10:00:00Z',
    });
  });

  it('remonte l’erreur du serveur', async () => {
    await expect(lireSolde(clientFaux({ error: new Error('x') }) as never, null)).rejects.toThrow('x');
  });

  it('lit les coûts du serveur', async () => {
    expect(await lireCouts(clientFaux() as never)).toEqual({ quiz_explanation: 1, exam_correction: 5 });
  });

  it('dépense côté serveur et renvoie le contenu', async () => {
    const c = clientFaux({ data: [{ status: 'spent', cost: 2, balance: 27, content: { correction_compressed: 'H4s' } }] });
    const r = await depenser(c as never, 'exercise_solution', 'ex-1');
    expect(c.rpc).toHaveBeenCalledWith('depenser_credits', { p_action: 'exercise_solution', p_ref: 'ex-1' });
    expect(r).toEqual({ statut: 'spent', cout: 2, solde: 27, contenu: { correction_compressed: 'H4s' } });
    expect(suivre).toHaveBeenCalledWith('credits_spent', { action: 'exercise_solution', cout: 2, solde: 27 });
  });

  it('solde insuffisant : aucun contenu, événement crédits épuisés', async () => {
    const c = clientFaux({ data: [{ status: 'insufficient', cost: 5, balance: 1, content: null }] });
    const r = await depenser(c as never, 'exam_correction', 12);
    expect(c.rpc).toHaveBeenCalledWith('depenser_credits', { p_action: 'exam_correction', p_ref: '12' });
    expect(r.contenu).toBeNull();
    expect(suivre).toHaveBeenCalledWith('credits_exhausted', { action: 'exam_correction', cout: 5, solde: 1 });
  });

  it('déjà débloqué ou pass : aucun événement de dépense', async () => {
    await depenser(clientFaux({ data: [{ status: 'already', cost: 0, balance: 10, content: {} }] }) as never, 'quiz_explanation', 1);
    await depenser(clientFaux({ data: [{ status: 'unlimited', cost: 0, balance: 10, content: {} }] }) as never, 'quiz_explanation', 2);
    expect(suivre).not.toHaveBeenCalled();
  });

  it('peutVoir interroge le serveur sans dépenser', async () => {
    const c = clientFaux({ data: true });
    expect(await peutVoir(c as never, 'document_pdf', 'd1')).toBe(true);
    expect(c.rpc).toHaveBeenCalledWith('can_view', { p_action: 'document_pdf', p_ref: 'd1' });
  });

  it('temps réel : solde et pass mis à jour', () => {
    const avant = {
      total: 29, semaine: 25, recompenses: 4, recharge: 25, prochaineRecharge: 'a', rechargeHebdo: true,
      illimite: false, illimiteJusqua: null, expirationRecompenses: null,
    };
    const maintenant = new Date('2026-10-01T12:00:00Z');
    const apres = appliquerTempsReel(avant, { weekly_left: 20, reward_left: 4, next_refill_at: 'b', unlimited_until: '2026-10-08T12:00:00Z' }, maintenant);
    expect(apres).toMatchObject({ total: 24, semaine: 20, illimite: true, illimiteJusqua: '2026-10-08T12:00:00Z', prochaineRecharge: 'b' });
    const fini = appliquerTempsReel(apres, { weekly_left: 20, reward_left: 4, next_refill_at: 'b', unlimited_until: '2026-09-30T12:00:00Z' }, maintenant);
    expect(fini).toMatchObject({ illimite: false, illimiteJusqua: null });
  });

  it('s’abonne à la ligne de l’élève et se désabonne', () => {
    const c = clientFaux();
    const recu = jest.fn();
    const arreter = suivreSolde(c as never, 'u1', recu);
    expect(c.channel).toHaveBeenCalledWith('credits:u1');
    const [type, filtre, rappel] = c.canal.on.mock.calls[0];
    expect(type).toBe('postgres_changes');
    expect(filtre).toEqual({ event: '*', schema: 'public', table: 'credit_balances', filter: 'user_id=eq.u1' });
    rappel({ new: { weekly_left: 3, reward_left: 0, next_refill_at: 'x', unlimited_until: null } });
    rappel({ new: {} });
    expect(recu).toHaveBeenCalledTimes(1);
    arreter();
    expect(c.removeChannel).toHaveBeenCalledWith(c.canal);
  });

  it('empreinte : ANDROID_ID sur Android', async () => {
    Platform.OS = 'android';
    jest.mocked(Application.getAndroidId).mockReturnValue('a1b2c3d4');
    expect(await identifiantAppareil()).toBe('android:a1b2c3d4');
  });

  it('empreinte : tirage gardé en local sans identifiant natif', async () => {
    Platform.OS = 'web';
    const premiere = await identifiantAppareil();
    expect(premiere).toMatch(/^local:/);
    expect(await AsyncStorage.getItem(CLE_APPAREIL)).toBe(premiere);
    expect(await identifiantAppareil()).toBe(premiere);
  });
});

describe('affichage des crédits', () => {
  it('découpe le délai jusqu’à lundi', () => {
    const maintenant = new Date('2026-10-02T18:00:00Z');
    expect(delaiJusqua('2026-10-04T23:00:00Z', maintenant)).toEqual({ jours: 2, heures: 5, minutes: 0 });
    expect(delaiJusqua('2026-10-02T21:20:00Z', maintenant)).toEqual({ jours: 0, heures: 3, minutes: 20 });
    expect(delaiJusqua('2026-10-01T00:00:00Z', maintenant)).toEqual({ jours: 0, heures: 0, minutes: 0 });
  });

  it('répartit la semaine depuis le journal', async () => {
    const gte = jest.fn(async () => ({
      data: [
        { delta: 25, kind: 'weekly' }, { delta: 5, kind: 'reward' }, { delta: -2, kind: 'spend' },
        { delta: -5, kind: 'spend' }, { delta: 5, kind: 'refund' }, { delta: 40, kind: 'welcome' },
      ],
      error: null,
    }));
    const c = { from: jest.fn(() => ({ select: jest.fn(() => ({ gte })) })) };
    expect(await lireSemaine(c as never, '2026-10-04T23:00:00.000Z')).toEqual({ recharge: 25, bienvenue: 40, recompenses: 5, depenses: 2 });
    expect(gte).toHaveBeenCalledWith('created_at', '2026-09-27T23:00:00.000Z');
  });
});
