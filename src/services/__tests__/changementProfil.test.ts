import AsyncStorage from '@react-native-async-storage/async-storage';

import { enregistrerProfil, lireProfil } from '../profil';
import { adopterProfil, lireMemoireProfil, passerAuToeic, revenirAuSecondaire } from '../changementProfil';

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
    // Pas de jest.spyOn ici : sur le mock AsyncStorage, spyOn + mockRestore laisse setItem sans
    // implémentation et casse les écritures des tests suivants du fichier (vérifié le 25/10/2026).
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disque plein'));
    await expect(passerAuToeic()).rejects.toThrow('disque plein');
    expect(await lireProfil()).toMatchObject({ type: 'eleve', niveau: 'Tle' });
  });
});

// Issue #125 : adoption générique depuis la page de changement — les profils permutent, rien n'est effacé.
describe('adopterProfil (page de changement)', () => {
  it('adopter un concours depuis le secondaire : le secondaire part en mémoire, le concours devient courant', async () => {
    await adopterProfil({ type: 'concours', niveau: 'ingenieurs', pays: 'CM', concours: { id: 'c1', sigle: 'ENS', nom: 'École Normale', ville: 'Yaoundé' }, termine: true });
    expect(await lireProfil()).toMatchObject({ type: 'concours', niveau: 'ingenieurs' });
    const memoire = await lireMemoireProfil();
    expect(memoire.secondaire).toMatchObject({ type: 'eleve', niveau: 'Tle' });
  });

  it('adopter le secondaire depuis le TOEIC : le TOEIC part en mémoire, et revenir au secondaire le retrouve', async () => {
    await passerAuToeic();
    await adopterProfil({ type: 'eleve', niveau: '2nde', pays: 'CM', termine: true });
    expect(await lireProfil()).toMatchObject({ type: 'eleve', niveau: '2nde' });
    const memoire = await lireMemoireProfil();
    expect(memoire.toeic).toMatchObject({ type: 'certification', exam: 'toeic' });
    expect(memoire.secondaire).toMatchObject({ type: 'eleve', niveau: 'Tle' });
    // Le retour au profil mémorisé d'origine reste possible.
    expect(await revenirAuSecondaire()).toBe(true);
    expect(await lireProfil()).toMatchObject({ type: 'eleve', niveau: 'Tle' });
  });

  it('une écriture refusée remonte et laisse le profil inchangé', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disque plein'));
    await expect(adopterProfil({ type: 'concours', niveau: 'ingenieurs', pays: 'CM', termine: true })).rejects.toThrow('disque plein');
    expect(await lireProfil()).toMatchObject({ type: 'eleve', niveau: 'Tle' });
  });
});
