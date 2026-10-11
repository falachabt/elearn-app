import AsyncStorage from '@react-native-async-storage/async-storage';

let mockEnLigne = true;
jest.mock('../connectivite', () => ({ estEnLigne: () => mockEnLigne }));

import { CLE_PASSAGES, jourLocal, type PassageLocal } from '../mission';
import { calculerProgression, lirePassages } from '../progression';

const aujourdHui = jourLocal();
const passage = (p: Partial<PassageLocal> = {}): PassageLocal => ({
  id: 'p1',
  day: aujourdHui,
  level: '3e',
  score: 3,
  total: 5,
  duration_s: 600,
  details: { chapitres: [{ libelleMatiere: 'Maths', bonnes: 3, total: 5 }] },
  envoye: false,
  ...p,
});

/** Client dont la lecture des missions réussit (serveur) ou échoue (hors ligne), et dont l'insertion est configurable. */
function client(lecture: { data?: unknown[]; erreur?: boolean }, insertion: () => Promise<{ error: unknown }> = async () => ({ error: null })) {
  const select = () => ({ gte: () => ({ order: async () => (lecture.erreur ? { data: null, error: new Error('hors ligne') } : { data: lecture.data ?? [], error: null }) }) });
  return { from: jest.fn((table: string) => (table === 'mission_runs' ? { select, insert: insertion } : {})) };
}

beforeEach(() => {
  mockEnLigne = true;
  return AsyncStorage.clear();
});

describe('progression hors ligne', () => {
  it('hors ligne : la progression se calcule sur les missions gardées sur le téléphone, jamais vide', async () => {
    await AsyncStorage.setItem(CLE_PASSAGES, JSON.stringify([passage()]));
    const passages = await lirePassages(client({ erreur: true }, async () => ({ error: new Error('hors ligne') })) as never);
    const p = calculerProgression(passages);
    expect(p.minutesSemaine).toBe(10);
    expect(p.matieres).toEqual([{ matiere: 'Maths', pourcentage: 60, questions: 5 }]);
  });

  it('hors ligne sans aucune mission gardée : l’erreur reste affichable', async () => {
    await expect(lirePassages(client({ erreur: true }) as never)).rejects.toThrow();
  });

  it('en ligne : une mission en attente est envoyée, comptée une seule fois, et marquée envoyée', async () => {
    await AsyncStorage.setItem(CLE_PASSAGES, JSON.stringify([passage()]));
    const lignes: unknown[] = [];
    const c = client({ data: lignes }, async () => {
      lignes.push({ day: aujourdHui, duration_s: 600, total: 5, details: { chapitres: [{ libelleMatiere: 'Maths', bonnes: 3, total: 5 }] } });
      return { error: null };
    });
    const passages = await lirePassages(c as never);
    expect(passages).toHaveLength(1);
    expect(calculerProgression(passages).minutesSemaine).toBe(10);
    expect(JSON.parse((await AsyncStorage.getItem(CLE_PASSAGES))!)[0].envoye).toBe(true);
  });

  it('en ligne, serveur lent à refléter l’envoi : la mission en attente s’ajoute sans doublon avec celles du serveur', async () => {
    await AsyncStorage.setItem(CLE_PASSAGES, JSON.stringify([passage({ id: 'a', envoye: true }), passage({ id: 'b', duration_s: 300 })]));
    const serveur = [{ day: aujourdHui, duration_s: 600, total: 5, details: { chapitres: [] } }];
    // L'envoi de « b » échoue encore : elle s'ajoute aux 10 minutes que le serveur connaît déjà pour « a ».
    const passages = await lirePassages(client({ data: serveur }, async () => ({ error: new Error('encore hors ligne') })) as never);
    expect(passages).toHaveLength(2);
    expect(calculerProgression(passages).minutesSemaine).toBe(15);
  });
});

describe('progression : jamais bloquée par le réseau', () => {
  it('hors ligne déclaré : aucune requête serveur, réponse immédiate depuis le téléphone', async () => {
    mockEnLigne = false;
    await AsyncStorage.setItem(CLE_PASSAGES, JSON.stringify([passage()]));
    const c = client({ data: [] });
    const passages = await lirePassages(c as never);
    expect(c.from).not.toHaveBeenCalled();
    expect(calculerProgression(passages).minutesSemaine).toBe(10);
  });

  it('serveur muet (requête qui ne répond jamais) : abandon au bout du délai, la progression locale s’affiche', async () => {
    jest.useFakeTimers();
    try {
      await AsyncStorage.setItem(CLE_PASSAGES, JSON.stringify([passage({ envoye: true })]));
      const pendante = { from: jest.fn(() => ({ select: () => ({ gte: () => ({ order: () => new Promise(() => {}) }) }), insert: () => new Promise(() => {}) })) };
      const attente = lirePassages(pendante as never);
      // 2 s d'attente bornée pour l'envoi, puis 5 s pour la lecture : jamais plus.
      await jest.advanceTimersByTimeAsync(7100);
      const passages = await attente;
      expect(calculerProgression(passages).minutesSemaine).toBe(10);
    } finally {
      jest.useRealTimers();
    }
  });
});
