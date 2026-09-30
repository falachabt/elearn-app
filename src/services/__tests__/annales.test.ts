import AsyncStorage from '@react-native-async-storage/async-storage';

import { concoursDuCatalogue, filtrer, lireCatalogue, lireDocuments, lireDossiers, nomDocument, lireSujet, optionsFiltres, titreSujet, type Sujet } from '../annales';

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

describe('annales rangées en dossiers', () => {
  it('nomDocument : accents mal décodés réparés, extension et tirets bas retirés', () => {
    expect(nomDocument('Sequence 3 Colle╠Çge Prive╠ü Montesquieu 2024_2025.pdf')).toBe('Sequence 3 Collège Privé Montesquieu 2024 2025');
    expect(nomDocument(' Maths ')).toBe('Maths');
  });

  it('concoursDuCatalogue : un dossier par concours, du plus fourni au moins fourni', async () => {
    const sujets = await lireCatalogue(client([ligne(1), ligne(2), ligne(3, { contest_id: 'c2', school_code: 'FMSB', contest: 'Médecine' })]) as never);
    expect(concoursDuCatalogue(sujets)).toEqual([
      { id: 'c1', nom: 'Concours 1re année', sigle: 'ENSPY', sujets: 2 },
      { id: 'c2', nom: 'Médecine', sigle: 'FMSB', sujets: 1 },
    ]);
  });

  it('lireDossiers : dossiers vides écartés, noms nettoyés', async () => {
    const c = client([{ folder_id: 'a', name: 'Maths ', subfolders: 1, documents: 4 }, { folder_id: 'b', name: 'Vide', subfolders: 0, documents: 0 }]);
    expect(await lireDossiers(c as never, { niveau: '3e', pays: 'CM' })).toEqual([{ id: 'a', nom: 'Maths', sousDossiers: 1, documents: 4 }]);
    expect(c.rpc).toHaveBeenCalledWith('class_document_folders', { p_level: '3e', p_country: 'CM', p_parent: null });
  });

  it('lireDocuments : sujet et corrigé', async () => {
    const c = client([{ document_id: 'd', name: 'Sujet_1.pdf', url: 'u', correction_url: null }]);
    expect(await lireDocuments(c as never, 'a')).toEqual([{ id: 'd', nom: 'Sujet 1', url: 'u', urlCorrection: null }]);
  });
});
