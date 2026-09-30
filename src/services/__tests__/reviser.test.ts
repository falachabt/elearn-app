import AsyncStorage from '@react-native-async-storage/async-storage';

import { couleurMatiere, lireCours, lireLecon, lireLecons, lireLues, marquerLue, nomCourt, pourcentageVu, regrouperParMatiere } from '../reviser';

const client = (data: unknown, error: unknown = null) => ({ rpc: jest.fn(async () => ({ data, error })) });

beforeEach(() => AsyncStorage.clear());

describe('reviser', () => {
  it('lit les cours de la classe et les garde pour le hors ligne', async () => {
    const c = client([
      { course_id: 1, name: ' Fractions ', subject: 'Mathématique', lessons: 3 },
      { course_id: 2, name: 'Sans matière', subject: null, lessons: 1 },
    ]);
    const cours = await lireCours(c as never, { niveau: '3e', pays: 'cm' });
    expect(c.rpc).toHaveBeenCalledWith('revision_courses', { p_level: '3e', p_country: 'cm' });
    expect(cours).toEqual([
      { id: 1, nom: 'Fractions', matiere: 'Mathématique', lecons: 3 },
      { id: 2, nom: 'Sans matière', matiere: 'Autres', lecons: 1 },
    ]);
    expect(await lireCours(client(null, new Error('hors ligne')) as never, { niveau: '3e', pays: 'CM' })).toEqual(cours);
  });

  it('hors ligne sans copie : erreur', async () => {
    await expect(lireCours(client(null, new Error('hors ligne')) as never, { niveau: '1re', pays: 'CM' })).rejects.toThrow('hors ligne');
  });

  it('regroupe par matière, noms courts et couleurs', () => {
    const m = regrouperParMatiere([
      { id: 1, nom: 'A', matiere: 'Mathématique', lecons: 2 },
      { id: 2, nom: 'B', matiere: 'Mathématique', lecons: 1 },
      { id: 3, nom: 'C', matiere: 'Autres', lecons: 1 },
      { id: 4, nom: 'D', matiere: 'LANGUE FRANÇAISE & LITTÉRATURE', lecons: 1 },
      { id: 5, nom: 'E', matiere: 'Français', lecons: 1 },
    ]);
    expect(m.map((x) => [x.nom, x.couleur, x.cours.length, x.lecons])).toEqual([
      ['Maths', 'maths', 2, 3],
      ['Français', 'francais', 2, 2],
      ['Autres', null, 1, 1],
    ]);
  });

  it.each([
    ['Sciences de la Vie et de la Terre, Éducation à l’Environnement, Hygiène et Biotechnologie', 'svt', 'SVT'],
    ['Chimie', 'physique', 'Chimie'],
    ['Éducation à la Citoyenneté', 'histoireGeo', 'Éducation à la citoyenneté'],
    ['Philosophie', 'philo', 'Philosophie'],
    ['Espagnol', 'anglais', 'Espagnol'],
    ['Informatique', null, 'Informatique'],
    ['SVT', 'svt', 'SVT'],
  ])('%s', (nom, couleur, court) => {
    expect(couleurMatiere(nom)).toBe(couleur);
    expect(nomCourt(nom)).toBe(court);
  });

  it('leçons dans l’ordre et contenu décodé', async () => {
    expect(await lireLecons(client([{ lesson_id: 7, name: 'Définition', reading_minutes: 5 }]) as never, 1)).toEqual([{ id: 7, nom: 'Définition', minutes: 5 }]);
    const l = await lireLecon(client([{ lesson_id: 7, course_id: 1, name: 'Définition', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bonjour' }] }], content_compressed: null }]) as never, 7);
    expect(l).toEqual({ id: 7, coursId: 1, nom: 'Définition', blocs: [{ type: 'paragraphe', retrait: 0, segments: [{ texte: 'Bonjour' }] }] });
    await expect(lireLecon(client([]) as never, 8)).rejects.toThrow();
  });

  it('leçons lues et pourcentage vu', async () => {
    await marquerLue(7, 1);
    await marquerLue(8, 1);
    await marquerLue(9, 2);
    expect(await lireLues()).toEqual({ 7: 1, 8: 1, 9: 2 });
    expect(pourcentageVu([{ id: 1, nom: 'A', matiere: 'M', lecons: 4 }], await lireLues())).toBe(50);
    expect(pourcentageVu([], {})).toBe(0);
  });
});
