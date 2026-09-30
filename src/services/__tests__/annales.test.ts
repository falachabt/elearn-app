import AsyncStorage from '@react-native-async-storage/async-storage';

import { filtrer, lireCatalogue, lireSujet, optionsFiltres, titreSujet, type Sujet } from '../annales';

const client = (data: unknown, error: unknown = null) => ({ rpc: jest.fn(async () => ({ data, error })) });
const ligne = (id: number, p: Record<string, unknown> = {}) => ({
  paper_id: id, contest_id: 'c1', school: 'École polytechnique', school_code: 'ENSPY', contest: 'Concours 1re année', subject: 'Maths',
  title: `Sujet Maths ${2020 + id}`, year: 2020 + id, has_correction: true, duration_min: null, free: id === 1, ...p,
});

beforeEach(() => AsyncStorage.clear());

describe('annales', () => {
  it.each([
    ['Sujet_CULTURE GÉNÉRALE ET BILINGUISME_2021', 'Culture générale et bilinguisme'],
    ['Sujet Mathématique ENSP 2023', 'Mathématique ENSP'],
    ['epreuve-de-chimie.pdf', 'Epreuve-de-chimie'],
    ['2024', '2024'],
  ])('titre : %s', (nom, attendu) => {
    expect(titreSujet(nom)).toBe(attendu);
  });

  it('lit le catalogue et le garde pour le hors ligne', async () => {
    const c = client([ligne(1), ligne(3, { school_code: null, subject: null })]);
    const s = await lireCatalogue(c as never);
    expect(c.rpc).toHaveBeenCalledWith('exam_catalog');
    expect(s[0]).toMatchObject({ id: 1, sigle: 'ENSPY', titre: 'Maths', annee: 2021, gratuit: true });
    expect(s[1]).toMatchObject({ sigle: 'École polytechnique', matiere: null, gratuit: false });
    expect(await lireCatalogue(client(null, new Error('hors ligne')) as never)).toEqual(s);
  });

  it('sans copie hors ligne : erreur', async () => {
    await expect(lireCatalogue(client(null, new Error('hors ligne')) as never)).rejects.toThrow();
  });

  it('filtres par école et année', () => {
    const s = [
      { id: 1, sigle: 'A', annee: 2023 },
      { id: 2, sigle: 'A', annee: 2021 },
      { id: 3, sigle: 'B', annee: 2023 },
      { id: 4, sigle: 'A', annee: null },
    ] as Sujet[];
    expect(optionsFiltres(s)).toEqual({ sigles: ['A', 'B'], annees: [2023, 2021] });
    expect(optionsFiltres(s, { sigle: 'B' }).annees).toEqual([2023]);
    expect(filtrer(s, { sigle: 'A', annee: 2023 }).map((x) => x.id)).toEqual([1]);
    expect(filtrer(s, {}).length).toBe(4);
  });

  it('détail : liens et verrou de la correction', async () => {
    const d = await lireSujet(client([{ paper_id: 2, title: 'Sujet Maths 2022', subject_url: 'https://s', correction_url: null, correction_locked: true }]) as never, 2);
    expect(d).toEqual({ id: 2, titre: 'Maths', urlSujet: 'https://s', urlCorrection: null, correctionVerrouillee: true });
    await expect(lireSujet(client([]) as never, 9)).rejects.toThrow();
  });
});
