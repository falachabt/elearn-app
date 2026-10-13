import AsyncStorage from '@react-native-async-storage/async-storage';

import { suivreException } from '../analytics';
import {
  CLE_JOURNAL_ERREURS,
  TAILLE_JOURNAL_ERREURS,
  journaliserErreur,
  lireJournalErreurs,
  viderJournalErreurs,
} from '../erreurs';

jest.mock('../analytics', () => ({
  lireEcranCourant: jest.fn(() => '/cours/lecon'),
  suivreException: jest.fn(),
}));

const attendreJournal = () => new Promise((r) => setTimeout(r, 30));

beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  await AsyncStorage.clear();
});
afterEach(() => jest.restoreAllMocks());

describe('journal d’erreurs', () => {
  it('range l’erreur avec son contexte : écran, version, plateforme, origine', async () => {
    journaliserErreur(new Error('boum'), 'boundary');
    await attendreJournal();
    const [e] = await lireJournalErreurs();
    expect(e).toMatchObject({ origine: 'boundary', message: 'boum', ecran: '/cours/lecon' });
    expect(typeof e.version).toBe('string');
    expect(typeof e.plateforme).toBe('string');
    expect(new Date(e.date).toString()).not.toBe('Invalid Date');
  });

  it('envoie à PostHog les erreurs de rendu avec leur contexte', () => {
    const erreur = new Error('rendu cassé');
    journaliserErreur(erreur, 'boundary');
    expect(suivreException).toHaveBeenCalledWith(erreur, expect.objectContaining({ origine: 'boundary', ecran: '/cours/lecon', plateforme: expect.any(String), version_app: expect.any(String), fatale: false }));
  });

  it('ne double pas les erreurs globales : le SDK les envoie déjà, le journal les garde seulement', async () => {
    journaliserErreur(new Error('non gérée'), 'global', true);
    await attendreJournal();
    expect(suivreException).not.toHaveBeenCalled();
    expect((await lireJournalErreurs())[0]).toMatchObject({ origine: 'global', fatale: true });
  });

  it('masque e-mails et numéros dans le message et la pile', async () => {
    journaliserErreur(new Error('échec pour marie@exemple.com au +237 612 345 678'), 'boundary');
    await attendreJournal();
    const brut = (await AsyncStorage.getItem(CLE_JOURNAL_ERREURS)) ?? '';
    expect(brut).not.toContain('marie@exemple.com');
    expect(brut).not.toContain('612 345 678');
    expect(brut).toContain('[email]');
  });

  it('accepte une valeur qui n’est pas une erreur', async () => {
    journaliserErreur('texte seul', 'global');
    await attendreJournal();
    expect((await lireJournalErreurs())[0].message).toBe('texte seul');
  });

  it(`ne garde que les ${TAILLE_JOURNAL_ERREURS} dernières erreurs`, async () => {
    for (let i = 0; i < TAILLE_JOURNAL_ERREURS + 5; i += 1) journaliserErreur(new Error(`e${i}`), 'global');
    await attendreJournal();
    const liste = await lireJournalErreurs();
    expect(liste).toHaveLength(TAILLE_JOURNAL_ERREURS);
    expect(liste[0].message).toBe('e5');
    expect(liste.at(-1)?.message).toBe(`e${TAILLE_JOURNAL_ERREURS + 4}`);
  });

  it('se vide, et survit à un stockage illisible', async () => {
    journaliserErreur(new Error('x'), 'global');
    await attendreJournal();
    await viderJournalErreurs();
    expect(await lireJournalErreurs()).toEqual([]);
    await AsyncStorage.setItem(CLE_JOURNAL_ERREURS, '{pas du json');
    expect(await lireJournalErreurs()).toEqual([]);
    expect(() => journaliserErreur(new Error('y'), 'global')).not.toThrow();
  });
});
