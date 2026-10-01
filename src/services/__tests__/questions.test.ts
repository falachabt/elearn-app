import AsyncStorage from '@react-native-async-storage/async-storage';

import { curseurSuivant, erreurTexte, lireCopieFil, lireFil, poserQuestion, signaler, TAILLE_PAGE, versQuestion } from '../questions';

const ligne = (id: string, p: Record<string, unknown> = {}) => ({
  id, author_id: 'u1', content: `Question ${id}`, media_urls: null, subject: 'Maths', class_level: '3e',
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
    const q = await lireFil(c as never, { matiere: 'Maths', classe: '3e' });
    expect(c.rpc).toHaveBeenCalledWith('questions_feed', { p_subject: 'Maths', p_class: '3e', p_before: null, p_limit: TAILLE_PAGE });
    expect(q).toHaveLength(2);
    expect(await lireCopieFil({ matiere: 'Maths', classe: '3e' })).toEqual(q);
    expect(await lireCopieFil({})).toBeNull();
  });

  it('hors ligne : sert la copie de la première page, pas des suivantes', async () => {
    const q = await lireFil(clientRpc([ligne('1')]) as never);
    const hors = clientRpc(null, new Error('hors ligne'));
    expect(await lireFil(hors as never)).toEqual(q);
    await expect(lireFil(hors as never, {}, '2026-10-01T00:00:00Z')).rejects.toThrow('hors ligne');
    await expect(lireFil(hors as never, { matiere: 'Physique' })).rejects.toThrow();
  });

  it('les pages suivantes ne remplacent pas la copie', async () => {
    const q = await lireFil(clientRpc([ligne('1')]) as never);
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
});
