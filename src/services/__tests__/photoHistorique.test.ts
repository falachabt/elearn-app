import { PAGE_HISTORIQUE, correctionDepuisResultat, lireHistorique } from '../photoHistorique';

const resultat = { matiere: 'maths', enonce: 'Résoudre $x^2=4$.', methode: 'Racine carrée', etapes: [{ titre: 'On isole', detail: '$x=\\pm 2$' }], resultat: '$x=2$ ou $x=-2$', a_retenir: 'Deux solutions.', notion: 'Équations' };

function client(lignes: unknown[], signees: { path: string; signedUrl: string }[] = []) {
  const requete: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'limit']) requete[m] = jest.fn(() => requete);
  requete.lt = jest.fn(() => requete);
  requete.then = (ok: (v: unknown) => unknown) => ok({ data: lignes, error: null });
  const signer = jest.fn(async () => ({ data: signees }));
  return { c: { from: jest.fn(() => requete), storage: { from: jest.fn(() => ({ createSignedUrls: signer })) } } as never, requete, signer };
}

describe('photoHistorique', () => {
  it('garde un résultat de correction affichable, refuse le reste', () => {
    expect(correctionDepuisResultat(resultat)?.etapes).toEqual([{ titre: 'On isole', detail: '$x=\\pm 2$' }]);
    expect(correctionDepuisResultat({ raison: 'floue' })).toBeNull();
    expect(correctionDepuisResultat(null)).toBeNull();
  });

  it('liste les corrections réussies avec l’adresse signée de leur photo', async () => {
    const { c, requete, signer } = client(
      [
        { id: 'a', created_at: '2026-10-02T08:00:00Z', result: resultat, feedback: 'clair', image_path: 'u/a.jpg' },
        { id: 'b', created_at: '2026-10-01T08:00:00Z', result: resultat, feedback: null, image_path: null },
      ],
      [{ path: 'u/a.jpg', signedUrl: 'https://signe/a' }],
    );
    const { entrees, fin } = await lireHistorique(c);
    expect(requete.eq).toHaveBeenCalledWith('status', 'done');
    expect(entrees.map((e) => [e.id, e.urlPhoto, e.avis])).toEqual([['a', 'https://signe/a', 'clair'], ['b', null, null]]);
    expect(signer).toHaveBeenCalledWith(['u/a.jpg'], 3600);
    expect(fin).toBe(true);
  });

  it('ignore une ligne au résultat inexploitable et signale qu’il reste des pages', async () => {
    const lignes = Array.from({ length: PAGE_HISTORIQUE + 1 }, (_, i) => ({ id: `l${i}`, created_at: `2026-09-${String(30 - i).padStart(2, '0')}T08:00:00Z`, result: i === 0 ? { vide: true } : resultat, feedback: null, image_path: null }));
    const { c } = client(lignes);
    const { entrees, fin } = await lireHistorique(c);
    expect(entrees).toHaveLength(PAGE_HISTORIQUE - 1);
    expect(fin).toBe(false);
  });

  it('page suivante : repart de la date de la dernière entrée', async () => {
    const { c, requete } = client([]);
    await lireHistorique(c, '2026-09-10T00:00:00Z');
    expect(requete.lt).toHaveBeenCalledWith('created_at', '2026-09-10T00:00:00Z');
  });

  it('une photo dont la signature échoue reste consultable sans photo', async () => {
    const { c } = client([{ id: 'a', created_at: '2026-10-02T08:00:00Z', result: resultat, feedback: null, image_path: 'u/a.jpg' }]);
    (c as { storage: { from: () => { createSignedUrls: () => Promise<never> } } }).storage.from = () => ({ createSignedUrls: async () => { throw new Error('réseau'); } });
    const { entrees } = await lireHistorique(c);
    expect(entrees[0].urlPhoto).toBeNull();
  });
});
