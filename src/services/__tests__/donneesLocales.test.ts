import AsyncStorage from '@react-native-async-storage/async-storage';

import { effacerDonneesLocales, restaurerHistorique } from '../donneesLocales';
import { CLE_HISTORIQUE } from '../mission';

beforeEach(() => AsyncStorage.clear());

describe('données du téléphone (M2-14)', () => {
  it('déconnexion : tout est effacé sauf la session Supabase', async () => {
    await AsyncStorage.multiSet([
      ['profil.arrivee', '{}'],
      ['reviser.lues', '{"1":2}'],
      [CLE_HISTORIQUE, '["2026-09-30"]'],
      ['sb-projet-auth-token', 'x'],
    ]);
    await effacerDonneesLocales();
    expect(await AsyncStorage.getAllKeys()).toEqual(['sb-projet-auth-token']);
  });

  it('connexion : les jours de mission du compte reviennent, sans doublon', async () => {
    await AsyncStorage.setItem(CLE_HISTORIQUE, JSON.stringify(['2026-09-30']));
    const client = { from: () => ({ select: async () => ({ data: [{ day: '2026-09-29' }, { day: '2026-09-30' }], error: null }) }) };
    expect(await restaurerHistorique(client as never)).toEqual(['2026-09-29', '2026-09-30']);
    expect(JSON.parse((await AsyncStorage.getItem(CLE_HISTORIQUE))!)).toEqual(['2026-09-29', '2026-09-30']);
  });
});
