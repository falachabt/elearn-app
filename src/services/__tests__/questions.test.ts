import AsyncStorage from '@react-native-async-storage/async-storage';

import { ajouterSortie, appliquerVote, contientNumero, envoyerSortie, envoyerSortiesEnAttente, lireSorties, masquerNumeros, parentPourReponse, choisirMeilleure, curseurSuivant, erreurTexte, fil, ilYa, lireReponses, voter, type Reponse, lireCopieFil, lireFil, poserQuestion, signaler, TAILLE_PAGE, versQuestion } from '../questions';

const ligne = (id: string, p: Record<string, unknown> = {}) => ({
  id, author_id: 'u1', author_name: 'Awa', has_ai: true, content: `Question ${id}`, media_urls: null, subject: 'Maths', class_level: '3e',
  created_at: `2026-10-01T10:0${id}:00Z`, answers_count: '2', resolved: false, mine: false, ...p,
});
const clientRpc = (data: unknown, error: unknown = null) => ({ rpc: jest.fn(async () => ({ data, error })) });

beforeEach(() => AsyncStorage.clear());

describe('questions', () => {
  it('convertit une ligne', () => {
    expect(versQuestion(ligne('1') as never)).toMatchObject({ id: '1', texte: 'Question 1', photos: [], reponses: 2, matiere: 'Maths', classe: '3e', resolue: false });
  });

  it('lit le fil avec les filtres et garde la première page', async () => {
    const c = clientRpc([ligne('1'), ligne('2')]);
    const { questions: q } = await lireFil(c as never, { matiere: 'Maths', classe: '3e' });
    expect(c.rpc).toHaveBeenCalledWith('questions_feed', { p_subject: 'Maths', p_class: '3e', p_before: null, p_limit: TAILLE_PAGE, p_resolved_only: false });
    expect(q).toHaveLength(2);
    expect(await lireCopieFil({ matiere: 'Maths', classe: '3e' })).toEqual(q);
    expect(await lireCopieFil({})).toBeNull();
  });

  it('hors ligne : sert la copie de la première page, pas des suivantes', async () => {
    const { questions: q } = await lireFil(clientRpc([ligne('1')]) as never);
    const hors = clientRpc(null, new Error('hors ligne'));
    expect(await lireFil(hors as never)).toEqual({ questions: q, copie: true });
    await expect(lireFil(hors as never, {}, '2026-10-01T00:00:00Z')).rejects.toThrow('hors ligne');
    await expect(lireFil(hors as never, { matiere: 'Physique' })).rejects.toThrow();
  });

  it('les pages suivantes ne remplacent pas la copie', async () => {
    const { questions: q } = await lireFil(clientRpc([ligne('1')]) as never);
    await lireFil(clientRpc([ligne('2')]) as never, {}, '2026-10-01T10:01:00Z');
    expect(await lireCopieFil({})).toEqual(q);
  });

  it('curseur : date de la dernière question si la page est pleine', () => {
    const pleine = Array.from({ length: TAILLE_PAGE }, (_, i) => versQuestion(ligne(String(i % 9)) as never));
    expect(curseurSuivant(pleine)).toBe(pleine[TAILLE_PAGE - 1].creeLe);
    expect(curseurSuivant(pleine.slice(1))).toBeNull();
  });

  it.each([['court', 'trop_court'], ['x'.repeat(1001), 'trop_long'], ['Comment résoudre x² = 4 ?', null]])('texte %#', (t, attendu) => {
    expect(erreurTexte(t)).toBe(attendu);
  });

  it('publie une question nettoyée', async () => {
    const single = jest.fn(async () => ({ data: { id: 'p1' }, error: null }));
    const insert = jest.fn(() => ({ select: () => ({ single }) }));
    const c = { from: jest.fn(() => ({ insert })) };
    expect(await poserQuestion(c as never, { texte: '  Comment résoudre x² = 4 ?  ', matiere: 'Maths', classe: '3e' })).toBe('p1');
    expect(c.from).toHaveBeenCalledWith('feed_posts');
    expect(insert).toHaveBeenCalledWith({ content: 'Comment résoudre x² = 4 ?', subject: 'Maths', class_level: '3e', media_urls: [] });
  });

  it('refuse un texte invalide sans appeler le serveur', async () => {
    const c = { from: jest.fn() };
    await expect(poserQuestion(c as never, { texte: 'court' })).rejects.toThrow('trop_court');
    expect(c.from).not.toHaveBeenCalled();
  });

  it('signale un contenu', async () => {
    const c = clientRpc(null);
    await signaler(c as never, 'comment', 'c1', 'harcelement');
    expect(c.rpc).toHaveBeenCalledWith('report_content', { p_type: 'comment', p_id: 'c1', p_reason: 'harcelement', p_details: null });
    await expect(signaler(clientRpc(null, new Error('non')) as never, 'post', 'p', 'autre')).rejects.toThrow('non');
  });

  it('lit les réponses et les garde hors ligne', async () => {
    const l = { id: 'r1', parent_id: null, author_name: 'Paul', is_ai: false, is_teacher: true, is_best: true, content: 'Oui', media_urls: null, score: 3, my_vote: 1, mine: false, created_at: '2026-10-01T10:00:00Z' };
    const c = clientRpc([l]);
    const r = await lireReponses(c as never, 'p1');
    expect(c.rpc).toHaveBeenCalledWith('question_replies', { p_post: 'p1' });
    expect(r[0]).toMatchObject({ id: 'r1', enseignant: true, meilleure: true, score: 3, monVote: 1 });
    expect(await lireReponses(clientRpc(null, new Error('x')) as never, 'p1')).toEqual(r);
    await expect(lireReponses(clientRpc(null, new Error('x')) as never, 'autre')).rejects.toThrow();
  });

  it('un seul niveau : les suites sont rattachées à leur réponse', () => {
    const r = (id: string, parentId: string | null) => ({ id, parentId } as Reponse);
    expect(fil([r('a', null), r('b', 'a'), r('c', null), r('d', 'zzz')]).map((x) => [x.reponse.id, x.suites.map((s) => s.id)])).toEqual([['a', ['b']], ['c', []], ['d', []]]);
  });

  it('vote local : ajout, annulation, changement', () => {
    const r = { monVote: 0, score: 2 } as Reponse;
    expect(appliquerVote(r, 1)).toMatchObject({ monVote: 1, score: 3 });
    expect(appliquerVote({ monVote: 1, score: 3 } as Reponse, 1)).toMatchObject({ monVote: 0, score: 2 });
    expect(appliquerVote({ monVote: 1, score: 3 } as Reponse, -1)).toMatchObject({ monVote: -1, score: 1 });
  });

  it('vote et meilleure réponse passent par le serveur', async () => {
    const c = clientRpc(4);
    expect(await voter(c as never, 'r1', -1)).toBe(4);
    expect(c.rpc).toHaveBeenCalledWith('vote_reply', { p_comment: 'r1', p_vote: -1 });
    await choisirMeilleure(c as never, 'p1', 'r1');
    expect(c.rpc).toHaveBeenCalledWith('set_best_answer', { p_post_id: 'p1', p_comment_id: 'r1' });
    await expect(voter(clientRpc(null, new Error('non')) as never, 'r', 1)).rejects.toThrow('non');
  });

  it.each([[30, 'maintenant', 0], [12 * 60000, 'minutes', 12], [3 * 3600000, 'heures', 3], [2 * 86400000, 'jours', 2]])('il y a %#', (ecart, cle, n) => {
    const now = Date.parse('2026-10-01T12:00:00Z');
    expect(ilYa(new Date(now - ecart).toISOString(), now)).toEqual({ cle, n });
  });

  it('détecte et masque un numéro, sans toucher aux petits nombres', () => {
    expect(contientNumero('appelle le 6 94 05 18 93')).toBe(true);
    expect(contientNumero('page 345 en 2024')).toBe(false);
    expect(masquerNumeros('au +237 694-05-18-93 stp')).toBe('au ••• ••• ••• stp');
  });

  it('un seul niveau : répondre à une suite rattache au parent', () => {
    const r = [{ id: 'a', parentId: null }, { id: 'b', parentId: 'a' }] as Reponse[];
    expect(parentPourReponse(r, null)).toBeNull();
    expect(parentPourReponse(r, 'a')).toBe('a');
    expect(parentPourReponse(r, 'b')).toBe('a');
  });

  it('file de sortie : gardée en cas d’échec, retirée après envoi, reprise à la reconnexion', async () => {
    const s = await ajouterSortie({ questionId: 'p1', texte: ' Salut ', parentId: 'a', photo: null });
    expect(await lireSorties('p1')).toHaveLength(1);
    const insert = jest.fn().mockResolvedValueOnce({ error: new Error('hors ligne') }).mockResolvedValueOnce({ error: null });
    const client = { from: jest.fn(() => ({ insert })), storage: {} };
    expect(await envoyerSortie(client as never, s, 'u1')).toBe(false);
    expect((await lireSorties('p1'))[0]).toMatchObject({ statut: 'echec', texte: ' Salut ' });
    expect(await envoyerSortiesEnAttente(client as never, 'p1', 'u1')).toBe(1);
    expect(insert).toHaveBeenLastCalledWith({ post_id: 'p1', content: 'Salut', parent_comment_id: 'a', media_urls: [] });
    expect(await lireSorties('p1')).toHaveLength(0);
  });
});
