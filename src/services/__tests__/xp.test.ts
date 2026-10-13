import { calculerNiveau, lireUserXp, notifierXpGagne, PALIERS_NIVEAU } from '../xp';

describe('services/xp', () => {
  describe('calculerNiveau', () => {
    it('calcule le niveau 1 (Débutant) pour 0 XP', () => {
      const info = calculerNiveau(0);
      expect(info.niveau).toBe(1);
      expect(info.ratioProgression).toBe(0);
      expect(info.xpRequisPourSuivant).toBe(100);
      expect(info.couleur).toBe('#9E998C');
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
      expect(info.couleur).toBe('#10B981');
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
});
