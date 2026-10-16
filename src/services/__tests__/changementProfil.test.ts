import AsyncStorage from '@react-native-async-storage/async-storage';

import { CLE_PROFIL, enregistrerProfil, lireProfil } from '../profil';
import { passerAuToeic, revenirAuSecondaire } from '../changementProfil';

jest.mock('../reglagesLocaux', () => ({ signalerModification: jest.fn(async () => {}) }));

beforeEach(async () => {
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'eleve', niveau: 'Tle', pays: 'CM', termine: true });
});

describe('changement de profil', () => {
  it('passer au TOEIC écrit le profil certification et garde le secondaire en mémoire', async () => {
    await passerAuToeic();
    const p = await lireProfil();
    expect(p?.type).toBe('certification');
    expect(p?.exam).toBe('toeic');
    expect(p?.pays).toBe('CM');
    expect(p?.termine).toBe(false);
  });

  it('revenir au secondaire restaure la classe gardée, et garde le TOEIC', async () => {
    await passerAuToeic();
    expect(await revenirAuSecondaire()).toBe(true);
    const p = await lireProfil();
    expect(p).toMatchObject({ type: 'eleve', niveau: 'Tle', pays: 'CM', termine: true });
    // Second aller-retour : le TOEIC gardé est repris, pas recréé.
    await passerAuToeic();
    expect((await lireProfil())?.type).toBe('certification');
  });

  it('revenir sans profil secondaire gardé ne change rien et le signale', async () => {
    await AsyncStorage.removeItem('profil.memoire');
    await AsyncStorage.setItem(CLE_PROFIL, JSON.stringify({ type: 'certification', exam: 'toeic', pays: 'CM', termine: false }));
    expect(await revenirAuSecondaire()).toBe(false);
    expect((await lireProfil())?.type).toBe('certification');
  });

  it('une écriture refusée remonte et laisse le profil inchangé (P6-ERR)', async () => {
    const spy = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disque plein'));
    await expect(passerAuToeic()).rejects.toThrow('disque plein');
    spy.mockRestore();
    expect(await lireProfil()).toMatchObject({ type: 'eleve', niveau: 'Tle' });
  });
});
