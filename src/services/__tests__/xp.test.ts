import AsyncStorage from '@react-native-async-storage/async-storage';

import { definirConnectivitePourTest } from '../connectivite';
import {
  CLE_XP_EN_ATTENTE,
  calculerNiveau,
  crediterXp,
  enregistrerNotificationNiveau,
  lireUserXp,
  notifierXpGagne,
  PALIERS_NIVEAU,
  reinitialiserCacheXp,
  reinitialiserVerrousCreditation,
  synchroniserXp,
} from '../xp';

describe('services/xp', () => {
  beforeEach(async () => {
    reinitialiserCacheXp();
    await AsyncStorage.clear();
    reinitialiserVerrousCreditation();
  });
  describe('calculerNiveau', () => {
    it('calcule le niveau 1 (Débutant) pour 0 XP', () => {
      const info = calculerNiveau(0);
      expect(info.niveau).toBe(1);
      expect(info.ratioProgression).toBe(0);
      expect(info.xpRequisPourSuivant).toBe(100);
      expect(info.couleur).toBe('#B69CFF');
    });

    it('calcule la progression au sein du niveau 1', () => {
      const info = calculerNiveau(50);
      expect(info.niveau).toBe(1);
      expect(info.ratioProgression).toBe(0.5);
      expect(info.xpActuelDansNiveau).toBe(50);
      expect(info.xpRequisPourSuivant).toBe(50);
    });

    it('calcule le niveau 3 (Confirmé) pour 340 XP', () => {
      // Palier 3 : de 250 à 500 XP (tranche = 250)
      // Acquis dans le niveau = 340 - 250 = 90
      // 90 / 250 = 0.36
      const info = calculerNiveau(340);
      expect(info.niveau).toBe(3);
      expect(info.xpActuelDansNiveau).toBe(90);
      expect(info.xpRequisPourSuivant).toBe(160);
      expect(info.ratioProgression).toBeCloseTo(0.36);
      expect(info.couleur).toBe('#7BC74D');
    });

    it('calcule le palier max (Niveau 10 Légende)', () => {
      const info = calculerNiveau(15000);
      expect(info.niveau).toBe(10);
      expect(info.seuilSuivant).toBeNull();
      expect(info.xpRequisPourSuivant).toBe(0);
      expect(info.ratioProgression).toBe(1);
      expect(info.couleur).toBe('#FFD83D');
    });

    it('gère les valeurs négatives ou nulles en toute sécurité', () => {
      const info = calculerNiveau(-100);
      expect(info.niveau).toBe(1);
      expect(info.totalXp).toBe(0);
      expect(info.ratioProgression).toBe(0);
    });
  });

  describe('lireUserXp', () => {
    it('renvoie 0 si userId est absent', async () => {
      const client = { from: jest.fn() } as any;
      const res = await lireUserXp(client, null);
      expect(res).toBe(0);
      expect(client.from).not.toHaveBeenCalled();
    });

    it('lit la table user_xp de Supabase pour le compte', async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValue({ data: { total_xp: 420 }, error: null });
      const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      const client = { from: jest.fn().mockReturnValue({ select: mockSelect }) } as any;

      const res = await lireUserXp(client, 'user-123');
      expect(res).toBe(420);
      expect(client.from).toHaveBeenCalledWith('user_xp');
      expect(mockSelect).toHaveBeenCalledWith('total_xp');
      expect(mockEq).toHaveBeenCalledWith('userid', 'user-123');
    });

    it('replie sur 0 en cas d’erreur Supabase', async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: new Error('Erreur') });
      const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      const client = { from: jest.fn().mockReturnValue({ select: mockSelect }) } as any;

      const res = await lireUserXp(client, 'user-123');
      expect(res).toBe(0);
    });
  });

  describe('PALIERS_NIVEAU', () => {
    it('définit bien les 10 paliers ordonnés', () => {
      expect(PALIERS_NIVEAU).toHaveLength(10);
      expect(PALIERS_NIVEAU[0].niveau).toBe(1);
      expect(PALIERS_NIVEAU[9].niveau).toBe(10);
    });
  });

  describe('notifierXpGagne', () => {
    it('notifie sans lever d’erreur', () => {
      expect(() => notifierXpGagne(15, 65, 'quiz')).not.toThrow();
    });
  });

  describe('crediterXp', () => {
    it('ajoute l’XP en base et persiste localement', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      const mockMaybeSingle = jest.fn().mockResolvedValue({ data: { total_xp: 60 }, error: null });
      const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      const client = {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'xp_history') return { insert: mockInsert };
          if (table === 'user_xp') return { select: mockSelect };
          return {};
        }),
      } as any;

      const nouveau = await crediterXp(client, 'user-1', 50, 'daily_mission');
      expect(nouveau).toBe(110);
      expect(mockInsert).toHaveBeenCalledWith({
        userid: 'user-1',
        xp_gained: 50,
        source_type: 'quiz',
        source_id: 'daily_mission',
      });
    });

    it('gère l’absence d’utilisateur (invité/local)', async () => {
      const nouveau = await crediterXp(null, null, 15, 'exercise');
      expect(nouveau).toBeGreaterThanOrEqual(15);
    });

    it('ignore un deuxième appel identique pour la mission du jour', async () => {
      let totalCourant = 0;
      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      const mockMaybeSingle = jest.fn().mockImplementation(() => Promise.resolve({ data: { total_xp: totalCourant }, error: null }));
      const mockUpsert = jest.fn().mockImplementation((payload: { total_xp: number }) => {
        totalCourant = payload.total_xp;
        return Promise.resolve({ error: null });
      });
      const client = {
        from: jest.fn().mockImplementation((table: string) => {
          if (table === 'xp_history') return { insert: mockInsert };
          if (table === 'user_xp') return { select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }), upsert: mockUpsert };
          return {};
        }),
      } as any;

      const premier = await crediterXp(client, 'user-idempotent', 50, 'daily_mission', '2026-10-14');
      expect(premier).toBe(50);

      // Deuxième appel le même jour : pas de deuxième crédit
      const deuxieme = await crediterXp(client, 'user-idempotent', 50, 'daily_mission', '2026-10-14');
      expect(deuxieme).toBe(50);
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });
  });

  // Retour terrain du 23 octobre 2026 : 2 leçons terminées hors ligne (+40 XP, total affiché 910), puis le total
  // est revenu à 870 à la reconnexion — le gain n'existait que localement et la lecture serveur l'a écrasé.
  describe('gains hors ligne (file d’attente)', () => {
    const clientHorsLigne = () => ({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'xp_history') return { insert: jest.fn().mockResolvedValue({ error: new Error('Failed to fetch') }) };
        if (table === 'user_xp') return { select: () => ({ eq: () => ({ maybeSingle: jest.fn().mockResolvedValue({ data: null, error: new Error('Failed to fetch') }) }) }), upsert: jest.fn().mockResolvedValue({ error: null }) };
        return {};
      }),
    }) as any;

    const clientEnLigne = (totalServeur: () => number, insert: jest.Mock) => ({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'xp_history') return {
          insert,
          select: () => ({ eq: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }),
        };
        if (table === 'user_xp') return { select: () => ({ eq: () => ({ maybeSingle: jest.fn().mockImplementation(() => Promise.resolve({ data: { total_xp: totalServeur() }, error: null })) }) }), upsert: jest.fn().mockResolvedValue({ error: null }) };
        return {};
      }),
    }) as any;

    it('un gain hors ligne est gardé en attente et le total lu ensuite l’inclut (pas d’écrasement à 870)', async () => {
      await AsyncStorage.setItem('xp.totalLocal', '870');
      const total = await crediterXp(clientHorsLigne(), 'user-xp', 40, 'course', '101');
      expect(total).toBe(910);
      const file = JSON.parse((await AsyncStorage.getItem(CLE_XP_EN_ATTENTE)) ?? '[]');
      expect(file).toHaveLength(1);
      expect(file[0]).toMatchObject({ userId: 'user-xp', gain: 40, source: 'course', sourceId: '101' });

      // Reconnexion : le serveur dit toujours 870, le total affiché doit rester 910 (870 + en attente).
      reinitialiserCacheXp();
      const relu = await lireUserXp(clientEnLigne(() => 870, jest.fn()), 'user-xp');
      expect(relu).toBe(910);
    });

    it('synchroniserXp rejoue les gains en attente et vide la file', async () => {
      await AsyncStorage.setItem(CLE_XP_EN_ATTENTE, JSON.stringify([
        { userId: 'user-xp', gain: 20, source: 'course', sourceId: '101', le: '2026-10-23T08:00:00.000Z' },
        { userId: 'user-xp', gain: 20, source: 'course', sourceId: '102', le: '2026-10-23T08:01:00.000Z' },
        { userId: 'autre', gain: 5, source: 'quiz', sourceId: '9', le: '2026-10-23T08:02:00.000Z' },
      ]));
      let serveur = 870;
      const insert = jest.fn().mockImplementation((l: { xp_gained: number }) => {
        serveur += l.xp_gained;
        return Promise.resolve({ error: null });
      });
      await synchroniserXp(clientEnLigne(() => serveur, insert), 'user-xp');
      expect(insert).toHaveBeenCalledTimes(2);
      const reste = JSON.parse((await AsyncStorage.getItem(CLE_XP_EN_ATTENTE)) ?? '[]');
      expect(reste).toHaveLength(1);
      expect(reste[0].userId).toBe('autre');
      // Total local resynchronisé sur le serveur (910), les gains ne sont plus « en attente ».
      expect(await AsyncStorage.getItem('xp.totalLocal')).toBe('910');
    });

    // Retour terrain du 23 octobre 2026 : « avant d'être hors ligne j'étais à 910, en ligne je me suis
    // retrouvé à 1010 » — un écart qui ne correspondait pas aux gains. Mécanisme : crediterXp écrivait le
    // total ABSOLU (distant + en attente + gain) dans user_xp alors que les gains en attente n'étaient pas
    // encore dans l'historique ; à leur rejeu, le trigger les ajoutait une seconde fois.
    it('un gain crédité en ligne ne recompte pas les gains en attente (pas de double comptage au rejeu)', async () => {
      const etat = { total: 870, historique: [] as { userid: string; xp_gained: number; source_id: unknown }[] };
      const clientServeur = {
        from: jest.fn((table: string) => {
          if (table === 'xp_history') return {
            insert: jest.fn((l: { userid: string; xp_gained: number; source_id: unknown }) => {
              etat.historique.push(l);
              etat.total += l.xp_gained;
              return Promise.resolve({ error: null });
            }),
            select: jest.fn(() => ({
              eq: (_c1: string, v1: unknown) => ({
                eq: (_c2: string, v2: unknown) => ({
                  limit: () => Promise.resolve({ data: etat.historique.filter((h) => h.userid === v1 && h.source_id === v2), error: null }),
                }),
              }),
            })),
          };
          if (table === 'user_xp') return {
            select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { total_xp: etat.total }, error: null }) }) }),
            upsert: jest.fn((l: { total_xp: number }) => {
              etat.total = l.total_xp;
              return Promise.resolve({ error: null });
            }),
          };
          return {};
        }),
      } as any;

      await AsyncStorage.setItem('xp.totalLocal', '910');
      await AsyncStorage.setItem(CLE_XP_EN_ATTENTE, JSON.stringify([
        { userId: 'user-xp', gain: 40, source: 'course', sourceId: '101', le: '2026-10-23T08:00:00.000Z' },
      ]));
      reinitialiserCacheXp();
      const affiche = await crediterXp(clientServeur, 'user-xp', 20, 'course', '102');
      expect(affiche).toBe(930);
      // Ce que fait aussi SessionProvider à la connexion : après coup, rien ne doit bouger.
      await synchroniserXp(clientServeur, 'user-xp');
      expect(etat.total).toBe(930);
      expect(await AsyncStorage.getItem('xp.totalLocal')).toBe('930');
      expect(await AsyncStorage.getItem(CLE_XP_EN_ATTENTE)).toBeNull();
    });

    it('hors ligne déjà connu : le total local est servi tout de suite, sans requête réseau', async () => {
      await AsyncStorage.setItem('xp.totalLocal', '910');
      const from = jest.fn(() => { throw new Error('le réseau ne doit pas être tenté'); });
      definirConnectivitePourTest({ backend: false });
      try {
        reinitialiserCacheXp();
        await expect(lireUserXp({ from } as never, 'user-xp')).resolves.toBe(910);
        expect(from).not.toHaveBeenCalled();
      } finally {
        definirConnectivitePourTest({ backend: null });
      }
    });

    it('synchroniserXp garde la file si l’envoi échoue encore', async () => {
      await AsyncStorage.setItem(CLE_XP_EN_ATTENTE, JSON.stringify([
        { userId: 'user-xp', gain: 20, source: 'course', sourceId: '101', le: '2026-10-23T08:00:00.000Z' },
      ]));
      const insert = jest.fn().mockResolvedValue({ error: new Error('Failed to fetch') });
      await synchroniserXp(clientEnLigne(() => 870, insert), 'user-xp');
      const reste = JSON.parse((await AsyncStorage.getItem(CLE_XP_EN_ATTENTE)) ?? '[]');
      expect(reste).toHaveLength(1);
    });
  });

  describe('enregistrerNotificationNiveau', () => {
    it('insère dans la table notifications Supabase pour le compte', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      const client = {
        from: jest.fn().mockReturnValue({ insert: mockInsert }),
      } as any;

      await enregistrerNotificationNiveau(client, 'user-123', 2, 'Niveau 2 débloqué !', 'Tu passes au rang Apprenti !');
      expect(client.from).toHaveBeenCalledWith('notifications');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          type: 'level_up',
          title: 'Niveau 2 débloqué !',
          body: 'Tu passes au rang Apprenti !',
          data: { screen: '/xp', niveau: 2 },
        }),
      );
    });
  });
});
