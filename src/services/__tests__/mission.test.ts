import AsyncStorage from '@react-native-async-storage/async-storage';

import { suivre } from '../analytics';
import { calculerSerie, chargerMission, CLE_MISSION, convertir, jourLocal, lireDernierResultat, lireHistorique, terminerMission, type LigneMission } from '../mission';

jest.mock('../analytics', () => ({ suivre: jest.fn() }));

const VF = { vrai: 'Vrai', faux: 'Faux' };
const ligne = (i: number, p: Partial<LigneMission> = {}): LigneMission => ({
  question_id: i,
  quiz_id: `q${i}`,
  chapter: `Chapitre ${i}`,
  subject: 'Maths',
  kind: 'select',
  prompt: `Question ${i} ?`,
  options: [
    { id: 'opt_1', text: 'Un' },
    { id: 'opt_2', text: 'Deux' },
    { id: 'opt_3', text: 'Trois' },
  ],
  correct: ['opt_2'],
  explanation: 'Parce que.',
  ...p,
});

function clientFaux(rpc: { data?: unknown; error?: unknown }) {
  const insert = jest.fn(() => Promise.resolve({ error: null }));
  return { rpc: jest.fn(async () => ({ data: rpc.data ?? null, error: rpc.error ?? null })), from: jest.fn(() => ({ insert })), insert };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('convertir', () => {
  it('garde la bonne réponse après mélange', () => {
    const q = convertir(ligne(1), VF, () => 0)!;
    expect(q.choix[q.bonne]).toBe('Deux');
    expect(q).toMatchObject({ id: '1', chapitre: 'Chapitre 1', libelleMatiere: 'Maths', enonce: 'Question 1 ?' });
  });

  it('vrai/faux : Vrai puis Faux, libellés traduits', () => {
    const q = convertir(ligne(2, { kind: 'boolean', options: [{ id: 'F', text: 'False' }, { id: 'T', text: 'True' }], correct: ['F'] }), { vrai: 'True', faux: 'False' })!;
    expect(q.choix).toEqual(['True', 'False']);
    expect(q.bonne).toBe(1);
  });

  it('rejette une question dont la bonne réponse manque', () => {
    expect(convertir(ligne(3, { correct: ['opt_9'] }), VF)).toBeNull();
  });
});

describe('chargerMission', () => {
  it('tire la mission du serveur puis la garde pour la journée', async () => {
    const c = clientFaux({ data: [ligne(1), ligne(2), ligne(3), ligne(4), ligne(5)] });
    const m = await chargerMission(c as never, { niveau: '3e', pays: 'CM', vraiFaux: VF, jour: '2026-10-01' });
    expect(c.rpc).toHaveBeenCalledWith('daily_mission', { p_level: '3e', p_country: 'CM', p_day: '2026-10-01', p_size: 5 });
    expect(m).toMatchObject({ source: 'serveur', jour: '2026-10-01' });
    expect(m.questions).toHaveLength(5);
    const encore = await chargerMission(clientFaux({ error: new Error('hors ligne') }) as never, { niveau: '3e', pays: 'CM', vraiFaux: VF, jour: '2026-10-01' });
    expect(encore.questions.map((q) => q.id)).toEqual(m.questions.map((q) => q.id));
  });

  it('hors ligne ou trop peu de questions : questions embarquées de la classe', async () => {
    const m = await chargerMission(clientFaux({ data: [ligne(1)] }) as never, { niveau: '1re', pays: 'CM', vraiFaux: VF, jour: '2026-10-01' });
    expect(m.source).toBe('locale');
    expect(m.questions.length).toBe(5);
  });

  it('nouveau jour ou nouvelle classe : nouvelle mission', async () => {
    await AsyncStorage.setItem(CLE_MISSION, JSON.stringify({ jour: '2026-09-30', niveau: '3e', source: 'serveur', questions: [] }));
    const c = clientFaux({ data: [ligne(1), ligne(2), ligne(3)] });
    await chargerMission(c as never, { niveau: '3e', pays: 'CM', vraiFaux: VF, jour: '2026-10-01' });
    expect(c.rpc).toHaveBeenCalledTimes(1);
  });
});

describe('calculerSerie', () => {
  it('jours consécutifs', () => {
    expect(calculerSerie(['2026-09-28', '2026-09-29', '2026-09-30'], '2026-09-30')).toEqual({ serie: 3, graceUtilisee: false, faiteAujourdhui: true });
  });

  it("la mission du jour pas encore faite ne casse pas la série", () => {
    expect(calculerSerie(['2026-09-28', '2026-09-29'], '2026-09-30')).toMatchObject({ serie: 2, faiteAujourdhui: false });
  });

  it('un jour manqué : jour de grâce', () => {
    expect(calculerSerie(['2026-09-27', '2026-09-28', '2026-09-30'], '2026-09-30')).toEqual({ serie: 3, graceUtilisee: true, faiteAujourdhui: true });
  });

  it('deux jours manqués : la série repart', () => {
    expect(calculerSerie(['2026-09-26', '2026-09-27', '2026-09-30'], '2026-09-30').serie).toBe(1);
  });

  it('une seule grâce par semaine', () => {
    const jours = ['2026-09-20', '2026-09-22', '2026-09-23', '2026-09-25', '2026-09-26'];
    expect(calculerSerie(jours, '2026-09-26').serie).toBe(4);
  });

  it('grâce à nouveau possible après 7 jours', () => {
    const jours = ['2026-09-10', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-20'];
    expect(calculerSerie(jours, '2026-09-20').serie).toBe(9);
  });

  it('rien de joué', () => {
    expect(calculerSerie([], '2026-09-30')).toEqual({ serie: 0, graceUtilisee: false, faiteAujourdhui: false });
  });

  it('passage de mois', () => {
    expect(calculerSerie(['2026-09-30', '2026-10-01'], '2026-10-01').serie).toBe(2);
  });
});

describe('terminerMission', () => {
  it('résultat, série et envoi au serveur', async () => {
    await AsyncStorage.setItem('mission.historique', JSON.stringify(['2026-09-30']));
    const c = clientFaux({});
    const questions = [convertir(ligne(1), VF, () => 0)!, convertir(ligne(2), VF, () => 0)!];
    const r = await terminerMission(c as never, { questions, reponses: [questions[0].bonne, 0 === questions[1].bonne ? 1 : 0], niveau: '3e', dureeS: 61.4, jour: '2026-10-01' });
    expect(r).toMatchObject({ score: 1, total: 2, serie: 2, jour: '2026-10-01', dureeS: 61 });
    expect(await lireHistorique()).toEqual(['2026-09-30', '2026-10-01']);
    expect((await lireDernierResultat())?.score).toBe(1);
    expect(c.from).toHaveBeenCalledWith('mission_runs');
    expect(c.insert).toHaveBeenCalledWith(expect.objectContaining({ day: '2026-10-01', level: '3e', score: 1, total: 2, duration_s: 61 }));
    expect(suivre).toHaveBeenCalledWith('mission_completed', { score: 1, total: 2, duree_s: 61, serie: 2 });
  });

  it('jour local AAAA-MM-JJ', () => {
    expect(jourLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
