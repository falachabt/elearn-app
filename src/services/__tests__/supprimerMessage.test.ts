import { supprimerQuestion, supprimerReponse } from '../questions';

/** Client factice : `from(table).delete().eq('id', id)` renvoie `{ error }`. */
function clientFactice(erreur: unknown = null) {
  const eq = jest.fn(async () => ({ error: erreur }));
  const del = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ delete: del }));
  return { client: { from } as never, from, del, eq };
}

describe('suppression de sa propre question ou réponse', () => {
  it('supprime la question dans feed_posts, par identifiant', async () => {
    const { client, from, del, eq } = clientFactice();
    await supprimerQuestion(client, 'q1');
    expect(from).toHaveBeenCalledWith('feed_posts');
    expect(del).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith('id', 'q1');
  });

  it('supprime la réponse dans post_comments, par identifiant', async () => {
    const { client, from, eq } = clientFactice();
    await supprimerReponse(client, 'r1');
    expect(from).toHaveBeenCalledWith('post_comments');
    expect(eq).toHaveBeenCalledWith('id', 'r1');
  });

  it('remonte l’erreur du serveur (refus RLS ou réseau)', async () => {
    const erreur = { message: 'permission denied' };
    const { client } = clientFactice(erreur);
    await expect(supprimerQuestion(client, 'q1')).rejects.toBe(erreur);
    await expect(supprimerReponse(client, 'r1')).rejects.toBe(erreur);
  });
});
