import AsyncStorage from '@react-native-async-storage/async-storage';

import { avecCopie, couleurMatiere, FRAICHEUR_COPIE_MS, iconeMatiere, lireCours, lireFiche, lireQuizLecon, lireLecon, lireLecons, lireLues, marquerLue, nomCourt, oublierCopiesEnMemoire, pourcentageVu, programmeDu, regrouperParMatiere, synchroniserLues } from '../reviser';

// Les tests passent des dates factices (époque 1000 ms) : le contrôle d'expiration réel conclurait « périmé » à
// chaque fois. On le neutralise ici, et le test dédié le force à `false` pour vérifier le blocage.
jest.mock('../connectivite', () => ({ contenuHorsLigneValide: jest.fn(async () => true) }));

const { contenuHorsLigneValide } = jest.requireMock('../connectivite') as { contenuHorsLigneValide: jest.Mock };

const client = (data: unknown, error: unknown = null) => ({ rpc: jest.fn(async () => ({ data, error })) });

beforeEach(() => {
  AsyncStorage.clear();
  contenuHorsLigneValide.mockResolvedValue(true);
});

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

  it('candidat : les cours de son concours, gardés à part', async () => {
    const c = client([{ course_id: 7, name: 'Analyse', subject: 'Mathématique', lessons: 4 }]);
    const cours = await lireCours(c as never, { niveau: 'ingenieurs', pays: 'CM', concours: 'c1' });
    expect(c.rpc).toHaveBeenCalledWith('contest_courses', { p_contest: 'c1' });
    expect(cours).toEqual([{ id: 7, nom: 'Analyse', matiere: 'Mathématique', lecons: 4 }]);
    expect(await lireCours(client(null, new Error('hors ligne')) as never, { niveau: 'ingenieurs', pays: 'CM', concours: 'c1' })).toEqual(cours);
    await expect(lireCours(client(null, new Error('hors ligne')) as never, { niveau: 'ingenieurs', pays: 'CM', concours: 'c2' })).rejects.toThrow('hors ligne');
  });

  it('utilise le programme sélectionné, sans appliquer un ancien concours au profil élève', () => {
    expect(programmeDu({ type: 'eleve', niveau: 'Tle', pays: 'CM', concours: { id: 'ancien-concours' } })).toEqual({
      niveau: 'Tle',
      pays: 'CM',
      concours: null,
    });
    expect(programmeDu({ type: 'concours', niveau: 'ingenieurs', concours: { id: 'concours-actuel' } })).toEqual({
      niveau: 'ingenieurs',
      pays: 'CM',
      concours: 'concours-actuel',
    });
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

  it.each([
    ['Mathématique', 'calculator-outline'],
    ['Sciences de la Vie et de la Terre', 'leaf-outline'],
    ['Physique-Chimie', 'flask-outline'],
    ['Éducation Physique et Sportive', 'football-outline'],
    ['Langue française', 'create-outline'],
    ['English Language', 'language-outline'],
    ['Histoire-Géographie', 'earth-outline'],
    ['Informatique', 'laptop-outline'],
    ['Philosophie', 'bulb-outline'],
    ['Économie', 'trending-up-outline'],
    ['Particularités', 'library-outline'],
  ])('icône de %s', (nom, icone) => {
    expect(iconeMatiere(nom)).toBe(icone);
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

  it('fiche : blocs non compressés, gardée hors ligne ; null si vide', async () => {
    const c = client([{ summary_id: 1, name: ' Fiche ', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Clé' }] }] }]);
    const f = await lireFiche(c as never, 7);
    expect(c.rpc).toHaveBeenCalledWith('course_summary', { p_course: 7 });
    expect(f?.nom).toBe('Fiche');
    expect(f?.blocs).toHaveLength(1);
    expect(await lireFiche(client(null, new Error('hors ligne')) as never, 7)).toEqual(f);
    expect(await lireFiche(client([]) as never, 8)).toBeNull();
  });

  it('quiz de leçon : questions converties, invalides écartées', async () => {
    const ligne = (id: number, correct: string) => ({ question_id: id, quiz_id: 'q', chapter: 'C', subject: 'Maths', kind: 'select', prompt: 'Q ?', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correct: [correct], explanation: null });
    const c = client([ligne(1, 'a'), ligne(2, 'z')]);
    const q = await lireQuizLecon(c as never, { cours: 3, lecon: 4, vraiFaux: { vrai: 'Vrai', faux: 'Faux' } });
    expect(c.rpc).toHaveBeenCalledWith('lesson_quiz', { p_course: 3, p_lesson: 4, p_size: 3 });
    expect(q.map((x) => x.id)).toEqual(['1']);
    // Même leçon le même jour : copie locale, sans nouvelle requête.
    c.rpc.mockClear();
    expect((await lireQuizLecon(c as never, { cours: 3, lecon: 4, vraiFaux: { vrai: 'Vrai', faux: 'Faux' } })).map((x) => x.id)).toEqual(['1']);
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it('leçons validées : envoie celles du téléphone et récupère celles du compte', async () => {
    await AsyncStorage.clear();
    const rpc = jest.fn(async () => ({ data: 1, error: null }));
    const client = { rpc, from: () => ({ select: async () => ({ data: [{ lesson_id: 7, course_id: 70 }], error: null }) }) };
    await marquerLue(5, 50, client as never, { score: 2, total: 3 });
    expect(rpc).toHaveBeenCalledWith('validate_lessons', { p_items: [{ lesson_id: 5, course_id: 50, score: 2, total: 3 }] });
    rpc.mockClear();
    expect(await synchroniserLues(client as never)).toEqual({ '5': 50, '7': 70 });
    expect(rpc).toHaveBeenCalledWith('validate_lessons', { p_items: [{ lesson_id: 5, course_id: 50 }] });
    expect(await lireLues()).toEqual({ '5': 50, '7': 70 });
  });

  it('leçons validées hors ligne : la copie du téléphone reste', async () => {
    await AsyncStorage.clear();
    await marquerLue(5, 50);
    const client = { rpc: jest.fn(), from: () => ({ select: async () => ({ data: null, error: new Error('réseau') }) }) };
    expect(await synchroniserLues(client as never)).toEqual({ '5': 50 });
  });
});

describe('avecCopie', () => {
  beforeEach(() => AsyncStorage.clear());

  it('sert la copie fraîche sans requête ; plus ancienne, la sert tout de suite et la relit en arrière-plan', async () => {
    const lire = jest.fn().mockResolvedValueOnce(['v1']).mockResolvedValueOnce(['v2']).mockRejectedValueOnce(new Error('hors ligne'));
    expect(await avecCopie('test.cle', lire, 1000)).toEqual(['v1']);
    expect(await avecCopie('test.cle', lire, 1000 + FRAICHEUR_COPIE_MS - 1)).toEqual(['v1']);
    expect(lire).toHaveBeenCalledTimes(1);
    expect(await avecCopie('test.cle', lire, 1000 + FRAICHEUR_COPIE_MS)).toEqual(['v1']);
    expect(lire).toHaveBeenCalledTimes(2);
    await new Promise((r) => setTimeout(r, 0));
    expect(await avecCopie('test.cle', lire, 1000 + FRAICHEUR_COPIE_MS)).toEqual(['v2']);
    // Hors ligne : la copie reste servie.
    expect(await avecCopie('test.cle', lire, 1000 + 3 * FRAICHEUR_COPIE_MS)).toEqual(['v2']);
    expect(lire).toHaveBeenCalledTimes(3);
  });

  it('sans copie, attend le réseau ; une copie déjà lue ne relit pas le téléphone', async () => {
    const lire = jest.fn().mockResolvedValue(['v']);
    expect(await avecCopie('test.memoire', lire, 1000)).toEqual(['v']);
    const multiGet = jest.spyOn(AsyncStorage, 'multiGet');
    multiGet.mockClear();
    expect(await avecCopie('test.memoire', lire, 2000)).toEqual(['v']);
    expect(multiGet).not.toHaveBeenCalled();
  });

  it('reprend la copie du téléphone après un redémarrage, sans réseau', async () => {
    await avecCopie('test.redemarrage', async () => ['v'], 1000);
    oublierCopiesEnMemoire();
    const lire = jest.fn().mockRejectedValue(new Error('hors ligne'));
    expect(await avecCopie('test.redemarrage', lire, 2000)).toEqual(['v']);
    expect(lire).not.toHaveBeenCalled();
  });

  it('ne sert PAS une copie périmée : le contenu expiré est bien bloqué', async () => {
    // Issue #13 : au-delà de la durée de validité hors ligne, la copie locale ne doit plus être servie. `avecCopie`
    // est le point de passage unique des contenus (missions, cours, quiz, exercices, annales).
    await avecCopie('test.expire', async () => ['v'], 1000);
    oublierCopiesEnMemoire();
    contenuHorsLigneValide.mockResolvedValue(false);

    const lire = jest.fn().mockRejectedValue(new Error('hors ligne'));
    await expect(avecCopie('test.expire', lire, 2000)).rejects.toThrow('hors ligne');
    // La copie a bien été ignorée : on est parti du réseau.
    expect(lire).toHaveBeenCalledTimes(1);

    contenuHorsLigneValide.mockResolvedValue(true);
  });
});
