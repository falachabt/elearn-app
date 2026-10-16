import AsyncStorage from '@react-native-async-storage/async-storage';

import { enregistrerProfil, lireProfil } from '../profil';
import { passerAuToeic } from '../changementProfil';

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

  it('une écriture refusée remonte et laisse le profil inchangé (P6-ERR)', async () => {
    const spy = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disque plein'));
    await expect(passerAuToeic()).rejects.toThrow('disque plein');
    spy.mockRestore();
    expect(await lireProfil()).toMatchObject({ type: 'eleve', niveau: 'Tle' });
  });
});
