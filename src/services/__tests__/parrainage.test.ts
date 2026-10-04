import AsyncStorage from '@react-native-async-storage/async-storage';
import { Share } from 'react-native';

import {
  CLE_CODE_PARRAIN_INVITE,
  chargerStatsParrainage,
  lireCodeInvite,
  obtenirMonCode,
  partagerLienWhatsApp,
  sauvegarderCodeInvite,
} from '../parrainage';

describe('M15 · Services de Parrainage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('sauvegarderCodeInvite et lireCodeInvite en local', async () => {
    expect(await lireCodeInvite()).toBeNull();
    await sauvegarderCodeInvite('x79pa');
    expect(await lireCodeInvite()).toBe('X79PA');
    expect(await AsyncStorage.getItem(CLE_CODE_PARRAIN_INVITE)).toBe('X79PA');
  });

  it('partagerLienWhatsApp ouvre le menu de partage avec le bon message', async () => {
    const spy = jest.spyOn(Share, 'share').mockImplementation(async () => ({ action: Share.sharedAction }));
    await partagerLienWhatsApp('X79PA', 'Aïcha');
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Aïcha t’invite sur Elearn Prepa !'),
        url: 'https://elearnprepa.com/r/X79PA',
      }),
    );
    spy.mockRestore();
  });

  it('obtenirMonCode appelle le RPC Supabase get_my_referral_code', async () => {
    const mockRpc = jest.fn().mockResolvedValue({ data: 'X79PA', error: null });
    const client = { rpc: mockRpc };
    const code = await obtenirMonCode(client as any);
    expect(mockRpc).toHaveBeenCalledWith('get_my_referral_code');
    expect(code).toBe('X79PA');
  });

  it('chargerStatsParrainage structure correctement les données retournées', async () => {
    const mockData = {
      code: 'X79PA',
      liens_cliques: 5,
      comptes_crees: 3,
      pass_achetes: 1,
      credits_gagnes: 120,
      jalons: [
        { id: 'j1', referrals_needed: 1, reward_type: 'credits', reward_value: 50, label_fr: '1er ami', label_en: '1st friend', unlocked: true, claimed: true },
      ],
    };
    const mockRpc = jest.fn().mockResolvedValue({ data: mockData, error: null });
    const client = { rpc: mockRpc };
    const stats = await chargerStatsParrainage(client as any);
    expect(stats.code).toBe('X79PA');
    expect(stats.liensCliques).toBe(5);
    expect(stats.comptesCrees).toBe(3);
    expect(stats.passAchetes).toBe(1);
    expect(stats.creditsGagnes).toBe(120);
    expect(stats.jalons).toHaveLength(1);
    expect(stats.jalons[0].unlocked).toBe(true);
  });
});
