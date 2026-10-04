import { annulerSuppression, dateEffacement, demanderSuppression, enregistrerContactParent, lireContactParent, lireDemandeSuppression, retirerContactParent } from '../moi';

jest.mock('../analytics', () => ({ suivre: jest.fn() }));

const ligne = { name: 'Maman', phone: '+237677123456', consent_at: '2026-09-30T10:00:00Z', withdrawn_at: null };
const client = (p: { rpc?: unknown; from?: unknown; erreur?: unknown }) => ({
  rpc: jest.fn(async () => ({ data: p.rpc ?? null, error: p.erreur ?? null })),
  from: jest.fn(() => ({ select: () => ({ maybeSingle: async () => ({ data: p.from ?? null, error: p.erreur ?? null }) }) })),
});

describe('moi', () => {
  it('lit le contact du parent, ou null', async () => {
    expect(await lireContactParent(client({ from: ligne }) as never)).toEqual({ nom: 'Maman', telephone: '+237677123456', accord: ligne.consent_at, retire: null });
    expect(await lireContactParent(client({}) as never)).toBeNull();
  });

  it('enregistre le contact avec l’accord, retire le contact', async () => {
    const c = client({ rpc: ligne });
    expect((await enregistrerContactParent(c as never, { nom: 'Maman', telephone: '+237677123456', accord: true })).telephone).toBe('+237677123456');
    expect(c.rpc).toHaveBeenCalledWith('save_guardian_contact', { p_name: 'Maman', p_phone: '+237677123456', p_consent: true });
    await retirerContactParent(c as never);
    expect(c.rpc).toHaveBeenCalledWith('withdraw_guardian_contact');
  });

  it('erreur serveur remontée', async () => {
    await expect(enregistrerContactParent(client({ erreur: new Error('x') }) as never, { nom: 'A', telephone: '+2376', accord: true })).rejects.toThrow('x');
  });

  it('suppression : demande, lecture, annulation, date limite à 30 jours', async () => {
    const c = client({ rpc: '2026-09-30T10:00:00Z', from: { requested_at: '2026-09-30T10:00:00Z', processed_at: null } });
    expect(await demanderSuppression(c as never, '  ')).toBe('2026-09-30T10:00:00Z');
    expect(c.rpc).toHaveBeenCalledWith('request_account_deletion', { p_reason: null });
    expect(await lireDemandeSuppression(c as never)).toBe('2026-09-30T10:00:00Z');
    expect(await lireDemandeSuppression(client({ from: { requested_at: 'x', processed_at: 'y' } }) as never)).toBeNull();
    await annulerSuppression(c as never);
    expect(c.rpc).toHaveBeenCalledWith('cancel_account_deletion');
    expect(dateEffacement('2026-09-30T10:00:00Z').toISOString()).toBe('2026-10-30T10:00:00.000Z');
  });
});
