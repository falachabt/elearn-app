import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  cleAffichee,
  demanderFeuilleRecharge,
  dansFenetre,
  doitPresenter,
  estUrgente,
  feuilleRechargePrioritaire,
  lireDerniereAffichee,
  lireDerniereFinConnue,
  noterAffichee,
  noterFinConnue,
  sAbonnerFeuilleRecharge,
  situationPass,
  type SituationPass,
} from '../rechargePass';

const HEURE_MS = 3600 * 1000;
const dans = (heures: number) => new Date(Date.now() + heures * HEURE_MS).toISOString();
const acces = (fin: string) => ({ offre: 'month' as const, fin, source: 'order' });

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('#124 · rechargePass : situation du Pass', () => {
  it('un accès actif donne ses jours restants en jours calendaires', () => {
    const s = situationPass(acces(dans(72)), null, new Date());
    expect(s).toEqual({ genre: 'actif', offre: 'month', fin: expect.any(String), jours: 3 });
  });

  it('sans accès, une dernière fin dépassée donne l’état expiré, avec son offre', () => {
    const fin = dans(-24);
    expect(situationPass(null, { fin, offre: 'week' })).toEqual({ genre: 'expire', offre: 'week', fin });
  });

  it('sans accès ni fin connue dépassée : rien (gratuit de toujours, ou fin encore à venir)', () => {
    expect(situationPass(null, null)).toEqual({ genre: 'aucun' });
    expect(situationPass(null, { fin: dans(48), offre: 'month' })).toEqual({ genre: 'aucun' });
  });
});

describe('#124 · rechargePass : fenêtre et urgence', () => {
  const actif = (jours: number): SituationPass => ({ genre: 'actif', offre: 'month', fin: dans(jours * 24), jours });
  const expire: SituationPass = { genre: 'expire', offre: 'month', fin: dans(-24) };

  it('la fenêtre s’ouvre à J-3 inclus, pas à J-4 ; l’expiré est toujours dedans', () => {
    expect(dansFenetre(actif(3))).toBe(true);
    expect(dansFenetre(actif(4))).toBe(false);
    expect(dansFenetre(expire)).toBe(true);
    expect(dansFenetre({ genre: 'aucun' })).toBe(false);
  });

  it('urgent : veille, dernier jour et expiré ; pas à J-2 ni J-3', () => {
    expect(estUrgente(actif(0))).toBe(true);
    expect(estUrgente(actif(1))).toBe(true);
    expect(estUrgente(actif(2))).toBe(false);
    expect(estUrgente(actif(3))).toBe(false);
    expect(estUrgente(expire)).toBe(true);
  });
});

describe('#124 · rechargePass : règle de réaffichage (au plus une fois par jour, clé par la date de fin)', () => {
  const maintenant = new Date('2026-10-25T09:00:00');
  const actif3: SituationPass = { genre: 'actif', offre: 'month', fin: '2026-10-28T00:00:00.000Z', jours: 3 };

  it('première ouverture dans la fenêtre : on présente', () => {
    expect(doitPresenter(actif3, null, maintenant)).toBe(true);
  });

  it('déjà montrée aujourd’hui pour cette fin : on ne représente pas', () => {
    expect(doitPresenter(actif3, '2026-10-25T07:30:00', maintenant)).toBe(false);
  });

  it('montrée la veille : « Plus tard » a réarmé pour aujourd’hui', () => {
    expect(doitPresenter(actif3, '2026-10-24T18:00:00', maintenant)).toBe(true);
  });

  it('hors fenêtre (J-5), même jamais montrée : rien', () => {
    expect(doitPresenter({ genre: 'actif', offre: 'month', fin: '2026-10-30T00:00:00.000Z', jours: 5 }, null, maintenant)).toBe(false);
  });

  it('expiré : même cadence journalière jusqu’au rechargement', () => {
    const expire: SituationPass = { genre: 'expire', offre: 'month', fin: '2026-10-24T00:00:00.000Z' };
    expect(doitPresenter(expire, null, maintenant)).toBe(true);
    expect(doitPresenter(expire, '2026-10-25T08:00:00', maintenant)).toBe(false);
    expect(doitPresenter(expire, '2026-10-24T08:00:00', maintenant)).toBe(true);
  });

  it('le drapeau est clé par la date de fin : un Pass rechargé (nouvelle fin) repart de zéro', async () => {
    const fin1 = '2026-10-28T00:00:00.000Z';
    const fin2 = '2026-11-27T00:00:00.000Z';
    await noterAffichee(fin1, maintenant);
    expect(await lireDerniereAffichee(fin1)).toBe(maintenant.toISOString());
    // La nouvelle fin n’a aucun drapeau : quand elle entrera dans sa fenêtre, la feuille se représentera.
    expect(await lireDerniereAffichee(fin2)).toBeNull();
    expect(cleAffichee(fin1)).not.toBe(cleAffichee(fin2));
  });

  it('la dernière fin connue est rangée par élève', async () => {
    await noterFinConnue('u-1', { fin: '2026-10-28T00:00:00.000Z', offre: 'month' });
    expect(await lireDerniereFinConnue('u-1')).toEqual({ fin: '2026-10-28T00:00:00.000Z', offre: 'month' });
    expect(await lireDerniereFinConnue('u-2')).toBeNull();
  });
});

describe('#124 · rechargePass : priorité sur le récap « Ma semaine »', () => {
  const client = (fin: string | null) =>
    ({
      rpc: async (fn: string) =>
        fn === 'my_access'
          ? { data: fin ? [{ product_code: 'month', ends_at: fin, source: 'order' }] : [], error: null }
          : { data: null, error: null },
    }) as never;

  it('veille d’expiration, jamais montrée : prioritaire', async () => {
    await expect(feuilleRechargePrioritaire(client(dans(24)), 'u-1')).resolves.toBe(true);
  });

  it('à J-3 (pas urgent) : le récap garde la main', async () => {
    await expect(feuilleRechargePrioritaire(client(dans(72)), 'u-1')).resolves.toBe(false);
  });

  it('urgente mais déjà montrée aujourd’hui : le récap garde la main', async () => {
    const fin = dans(24);
    await noterAffichee(fin);
    await expect(feuilleRechargePrioritaire(client(fin), 'u-1')).resolves.toBe(false);
  });

  it('expiré jamais montré : prioritaire', async () => {
    const fin = dans(-24);
    await noterFinConnue('u-1', { fin, offre: 'month' });
    await expect(feuilleRechargePrioritaire(client(null), 'u-1')).resolves.toBe(true);
  });
});

describe('#124 · rechargePass : demande d’ouverture au toucher', () => {
  it('sans feuille abonnée, la demande renvoie false (l’appelant navigue)', () => {
    expect(demanderFeuilleRecharge({ joursRestants: 3 })).toBe(false);
  });

  it('la feuille abonnée reçoit la demande, puis plus rien après désabonnement', () => {
    const recus: unknown[] = [];
    const arreter = sAbonnerFeuilleRecharge((d) => recus.push(d));
    expect(demanderFeuilleRecharge({ joursRestants: 8 })).toBe(true);
    expect(recus).toEqual([{ joursRestants: 8 }]);
    arreter();
    expect(demanderFeuilleRecharge({ joursRestants: 8 })).toBe(false);
  });
});
