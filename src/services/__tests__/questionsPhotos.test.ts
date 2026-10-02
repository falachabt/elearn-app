import { envoyerPhoto, envoyerPhotos, nomPhoto, PHOTO_OCTETS_MAX, PHOTOS_MAX, poserQuestion } from '../questions';

/** Faux stockage qui se comporte comme Supabase : refuse un chemin déjà utilisé (409), garde les fichiers envoyés. */
function faux(opts: { echecA?: number; taille?: number } = {}) {
  const fichiers = new Set<string>();
  let n = 0;
  const upload = jest.fn(async (chemin: string) => {
    n += 1;
    if (opts.echecA === n) return { error: new Error('echec reseau') };
    if (fichiers.has(chemin)) return { error: new Error('The resource already exists') };
    fichiers.add(chemin);
    return { error: null };
  });
  const remove = jest.fn(async (chemins: string[]) => {
    chemins.forEach((c) => fichiers.delete(c));
    return { error: null };
  });
  const getPublicUrl = jest.fn((chemin: string) => ({ data: { publicUrl: `https://cdn/${chemin}` } }));
  const from = jest.fn(() => ({ upload, remove, getPublicUrl }));
  return { client: { storage: { from }, from: jest.fn() }, fichiers, upload, remove };
}

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(1_790_000_000_000); // même milliseconde pour toutes les photos : le cas du bug
  global.fetch = jest.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(1000) })) as never;
});
afterEach(() => jest.restoreAllMocks());

describe('envoi des photos d’une question', () => {
  it('nomPhoto : deux noms de la même milliseconde et du même rang sont différents', () => {
    expect(nomPhoto('u1', 0)).not.toBe(nomPhoto('u1', 0));
    expect(nomPhoto('u1', 2)).toMatch(/^u1\/1790000000000-2-[a-z0-9]+\.jpg$/);
  });

  it.each([1, 2, 3])('%i photo(s) : toutes envoyées avec des liens distincts', async (n) => {
    const { client, fichiers } = faux();
    const urls = await envoyerPhotos(client as never, Array.from({ length: n }, (_, i) => `file:///p${i}.jpg`), 'u1');
    expect(urls).toHaveLength(n);
    expect(new Set(urls).size).toBe(n);
    expect(fichiers.size).toBe(n);
  });

  it('3 photos envoyées dans la même milliseconde : plus de collision (bug du 01/10)', async () => {
    const { client } = faux();
    await expect(envoyerPhotos(client as never, ['a', 'b', 'c'], 'u1')).resolves.toHaveLength(3);
  });

  it('plus de 3 photos : seules les 3 premières partent', async () => {
    const { client, upload } = faux();
    const urls = await envoyerPhotos(client as never, ['a', 'b', 'c', 'd', 'e'], 'u1');
    expect(urls).toHaveLength(PHOTOS_MAX);
    expect(upload).toHaveBeenCalledTimes(PHOTOS_MAX);
  });

  it('grosse photo : refusée avant l’envoi avec une erreur claire', async () => {
    global.fetch = jest.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(PHOTO_OCTETS_MAX + 1) })) as never;
    const { client, upload } = faux();
    await expect(envoyerPhoto(client as never, 'file:///gros.jpg', 'u1')).rejects.toThrow('photo_trop_lourde');
    expect(upload).not.toHaveBeenCalled();
  });

  it('échec de la 3e photo : les 2 premières sont supprimées, l’erreur remonte', async () => {
    const { client, fichiers, remove } = faux({ echecA: 3 });
    await expect(envoyerPhotos(client as never, ['a', 'b', 'c'], 'u1')).rejects.toThrow('echec reseau');
    expect(remove).toHaveBeenCalledTimes(1);
    expect(fichiers.size).toBe(0);
  });

  it('échec de la 1re photo : rien à nettoyer', async () => {
    const { client, remove } = faux({ echecA: 1 });
    await expect(envoyerPhotos(client as never, ['a', 'b'], 'u1')).rejects.toThrow();
    expect(remove).not.toHaveBeenCalled();
  });

  it('de bout en bout : 3 photos puis la question avec les 3 liens', async () => {
    const { client } = faux();
    const urls = await envoyerPhotos(client as never, ['a', 'b', 'c'], 'u1');
    const single = jest.fn(async () => ({ data: { id: 'p1' }, error: null }));
    const insert = jest.fn(() => ({ select: () => ({ single }) }));
    expect(await poserQuestion({ from: jest.fn(() => ({ insert })) } as never, { texte: 'Comment résoudre ce problème ?', matiere: 'Maths', classe: '1re', photos: urls })).toBe('p1');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ media_urls: urls }));
    expect(urls).toHaveLength(3);
  });
});
