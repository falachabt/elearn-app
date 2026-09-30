import AsyncStorage from '@react-native-async-storage/async-storage';

import { BANQUE, questionsPour } from '@/contenu/miniTest';
import { CLASSES, CONCOURS } from '@/services/profil';

import {
  appreciation,
  calculerResultat,
  CLE_RESULTAT,
  enregistrerResultat,
  invitationDejaVue,
  lireResultat,
  marquerInvitationVue,
  melanger,
  synchroniserResultat,
  tirerMiniTest,
} from '../miniTest';

/** Suite pseudo-aléatoire reproductible. */
const graine = (n = 1) => () => {
  n = (n * 16807) % 2147483647;
  return (n - 1) / 2147483646;
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('banque du mini-test', () => {
  it.each([...CLASSES, ...CONCOURS])('%s : 5 questions, 4 choix distincts, bonne réponse valable, ids uniques', (niveau) => {
    const qs = BANQUE[niveau];
    expect(qs).toHaveLength(5);
    for (const q of qs) {
      expect(new Set(q.choix).size).toBe(4);
      expect(q.choix[q.bonne]).toBeTruthy();
      expect(q.explication.length).toBeGreaterThan(10);
    }
    const ids = Object.values(BANQUE).flat().map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('niveau inconnu : repli sur la 3e', () => {
    expect(questionsPour('inconnu')).toBe(BANQUE['3e']);
    expect(questionsPour(null)).toBe(BANQUE['3e']);
  });
});

describe('tirage', () => {
  it('mélange les choix sans perdre la bonne réponse', () => {
    const tirees = tirerMiniTest('3e', graine(7));
    tirees.forEach((q, i) => {
      const source = BANQUE['3e'][i];
      expect(q.choix[q.bonne]).toBe(source.choix[source.bonne]);
      expect([...q.choix].sort()).toEqual([...source.choix].sort());
    });
  });

  it('la bonne réponse ne tombe pas toujours au même rang', () => {
    const rangs = new Set(tirerMiniTest('6e', graine(3)).map((q) => q.bonne));
    expect(rangs.size).toBeGreaterThan(1);
  });

  it('melanger garde les éléments', () => {
    expect(melanger([1, 2, 3, 4, 5], graine(2)).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('résultat', () => {
  const qs = tirerMiniTest('3e', graine(5));
  const bonnes = qs.map((q) => q.bonne);
  const faux = (q: { bonne: number }) => (q.bonne + 1) % 4;

  it('4/5 avec une erreur en fractions : point fort équations, à revoir fractions', () => {
    const reponses = [...bonnes];
    reponses[2] = faux(qs[2]); // 3e-3 : fractions
    const r = calculerResultat(qs, reponses, { niveau: '3e', dureeS: 94.6 });
    expect(r).toMatchObject({ score: 4, total: 5, dureeS: 95, niveau: '3e' });
    expect(r.pointFort?.chapitre).toBe('Équations du 1er degré');
    expect(r.aRevoir).toMatchObject({ chapitre: 'Fractions', erreurs: 1 });
    expect(appreciation(r)).toBe('bien');
  });

  it('5/5 : rien à revoir ; 0/5 : pas de point fort', () => {
    const parfait = calculerResultat(qs, bonnes, { niveau: '3e', dureeS: 60 });
    expect(parfait.aRevoir).toBeUndefined();
    expect(appreciation(parfait)).toBe('excellent');
    const rate = calculerResultat(qs, qs.map(faux), { niveau: '3e', dureeS: 60 });
    expect(rate.pointFort).toBeUndefined();
    expect(rate.aRevoir?.erreurs).toBe(2);
    expect(appreciation(rate)).toBe('debut');
  });
});

describe('conservation et synchronisation (M1-04)', () => {
  const r = calculerResultat(tirerMiniTest('4e', graine(9)), [0, 0, 0, 0, 0], { niveau: '4e', dureeS: 80 });
  const client = (id: string | null, error: unknown = null) => {
    const insert = jest.fn().mockResolvedValue({ error });
    return {
      insert,
      c: {
        auth: { getSession: jest.fn().mockResolvedValue({ data: { session: id ? { user: { id } } : null } }) },
        from: jest.fn(() => ({ insert })),
      } as never,
    };
  };

  it('garde le résultat sur le téléphone', async () => {
    await enregistrerResultat(r);
    expect(await lireResultat()).toMatchObject({ score: r.score, niveau: '4e' });
  });

  it('envoie une fois par utilisateur, et de nouveau si le compte change', async () => {
    await enregistrerResultat(r);
    const a = client('u1');
    expect(await synchroniserResultat(a.c)).toBe(true);
    expect(a.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', kind: 'mini_test', level: '4e', score: r.score, total: 5, duration_s: 80 }));
    expect(await synchroniserResultat(client('u1').c)).toBe(false);
    const b = client('u2');
    expect(await synchroniserResultat(b.c)).toBe(true);
    expect(b.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u2' }));
  });

  it('erreur serveur ou pas de session : rien de perdu, réessayé plus tard', async () => {
    await enregistrerResultat(r);
    expect(await synchroniserResultat(client('u1', { message: 'relation does not exist' }).c)).toBe(false);
    expect(await synchroniserResultat(client(null).c)).toBe(false);
    const ok = client('u1');
    expect(await synchroniserResultat(ok.c)).toBe(true);
    expect(JSON.parse((await AsyncStorage.getItem(CLE_RESULTAT)) ?? '{}').synchronisePour).toBe('u1');
  });

  it('sans résultat : rien à envoyer', async () => {
    const a = client('u1');
    expect(await synchroniserResultat(a.c)).toBe(false);
    expect(a.insert).not.toHaveBeenCalled();
  });

  it('invitation A6 proposée une seule fois', async () => {
    expect(await invitationDejaVue()).toBe(false);
    await marquerInvitationVue();
    expect(await invitationDejaVue()).toBe(true);
  });
});
