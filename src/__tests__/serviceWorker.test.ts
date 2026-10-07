import fs from 'fs';
import path from 'path';

// Le service worker est un fichier public/ : on le charge dans un faux contexte de worker pour tester ses décisions.
type Gestionnaire = (event: Record<string, unknown>) => void;
type Rep = { ok: boolean; corps?: string; clone: () => Rep };
const source = fs.readFileSync(path.join(__dirname, '../../public/sw.js'), 'utf8');

function charger(options: { reseau?: (url: string) => Promise<Rep>; caches?: Map<string, Map<string, unknown>> } = {}) {
  const gestionnaires: Record<string, Gestionnaire> = {};
  const magasins = options.caches ?? new Map<string, Map<string, unknown>>();
  const cle = (r: unknown) => (typeof r === 'string' ? r : (r as { url: string }).url).replace('https://app.test', '') || '/';
  const reponse = (corps: string, ok = true): Rep => {
    const r: Rep = { ok, corps, clone: () => r };
    return r;
  };
  const fetch = jest.fn(async (r: unknown) => {
    const url = typeof r === 'string' ? r : (r as { url: string }).url;
    return options.reseau ? options.reseau(url) : reponse(`réseau:${url}`);
  });
  const caches = {
    open: async (nom: string) => {
      if (!magasins.has(nom)) magasins.set(nom, new Map());
      const m = magasins.get(nom) as Map<string, unknown>;
      return {
        add: async (u: string) => {
          const rep = await fetch(u);
          if (!rep.ok) throw new Error('absent');
          m.set(cle(u), rep);
        },
        put: async (r: unknown, rep: unknown) => void m.set(cle(r), rep),
      };
    },
    match: async (r: unknown) => {
      for (const m of magasins.values()) if (m.has(cle(r))) return m.get(cle(r));
      return undefined;
    },
    keys: async () => [...magasins.keys()],
    delete: async (nom: string) => magasins.delete(nom),
  };
  const self = {
    location: { origin: 'https://app.test' },
    addEventListener: (nom: string, f: Gestionnaire) => void (gestionnaires[nom] = f),
    skipWaiting: jest.fn(async () => {}),
    clients: { claim: jest.fn(async () => {}) },
  };
  new Function('self', 'caches', 'fetch', 'URL', source)(self, caches, fetch, URL);
  const evenement = async (nom: string, extra: Record<string, unknown> = {}) => {
    let attente: Promise<unknown> = Promise.resolve();
    let donnee: Promise<unknown> | undefined;
    gestionnaires[nom]({ ...extra, waitUntil: (p: Promise<unknown>) => void (attente = p), respondWith: (p: Promise<unknown>) => void (donnee = p) });
    await attente;
    return donnee ? await donnee : undefined;
  };
  const requete = (url: string, mode = 'cors', method = 'GET') => ({ url: `https://app.test${url}`, mode, method });
  return { self, fetch, magasins, evenement, requete };
}

describe('service worker de la PWA', () => {
  it('à l’installation, la coquille est mise en cache et le worker prend la main tout de suite', async () => {
    const sw = charger();
    await sw.evenement('install');
    const cache = sw.magasins.get('elearn-coquille-v1') as Map<string, unknown>;
    expect([...cache.keys()]).toEqual(expect.arrayContaining(['/', '/manifest.json', '/icon-192.png', '/icon-512.png']));
    expect(sw.self.skipWaiting).toHaveBeenCalled();
  });

  it('un fichier de coquille absent n’empêche pas l’installation', async () => {
    const faux = (u: string): Rep => {
      const r: Rep = { ok: !u.includes('favicon'), corps: u, clone: () => r };
      return r;
    };
    const sw = charger({ reseau: async (u) => faux(u) });
    await expect(sw.evenement('install')).resolves.toBeUndefined();
    expect((sw.magasins.get('elearn-coquille-v1') as Map<string, unknown>).has('/')).toBe(true);
  });

  it('à l’activation, les anciennes versions de la coquille sont supprimées, pas les autres caches', async () => {
    const sw = charger({ caches: new Map([['elearn-coquille-v0', new Map()], ['elearn-coquille-v1', new Map()], ['autre', new Map()]]) });
    await sw.evenement('activate');
    expect([...sw.magasins.keys()].sort()).toEqual(['autre', 'elearn-coquille-v1']);
    expect(sw.self.clients.claim).toHaveBeenCalled();
  });

  it('page : réseau d’abord et copie gardée ; hors ligne, la page en cache s’ouvre, sur n’importe quelle route', async () => {
    const sw = charger();
    await sw.evenement('install');
    const en = (await sw.evenement('fetch', { request: sw.requete('/moi', 'navigate') })) as Rep;
    expect(en.corps).toBe('réseau:https://app.test/moi');
    const hors = charger({ caches: sw.magasins, reseau: async () => { throw new TypeError('Failed to fetch'); } });
    const rep = (await hors.evenement('fetch', { request: hors.requete('/reviser/cours', 'navigate') })) as Rep;
    expect(rep.corps).toBe('réseau:https://app.test/moi');
  });

  it('fichier de l’app (/_expo, /assets) : cache d’abord, rempli au premier passage, servi hors ligne', async () => {
    const sw = charger();
    const un = (await sw.evenement('fetch', { request: sw.requete('/_expo/static/js/web/entry-abc.js') })) as Rep;
    expect(un.corps).toContain('entry-abc.js');
    sw.fetch.mockClear();
    const deux = (await sw.evenement('fetch', { request: sw.requete('/_expo/static/js/web/entry-abc.js') })) as Rep;
    expect(deux.corps).toBe(un.corps);
    expect(sw.fetch).not.toHaveBeenCalled();
    const hors = charger({ caches: sw.magasins, reseau: async () => { throw new TypeError('hors ligne'); } });
    expect(((await hors.evenement('fetch', { request: hors.requete('/_expo/static/js/web/entry-abc.js') })) as Rep).corps).toBe(un.corps);
  });

  it('une réponse en erreur n’est pas gardée', async () => {
    const echec: Rep = { ok: false, clone: () => echec };
    const sw = charger({ reseau: async () => echec });
    await sw.evenement('fetch', { request: sw.requete('/assets/x.png') });
    expect(sw.magasins.get('elearn-coquille-v1')?.has('/assets/x.png') ?? false).toBe(false);
  });

  it('jamais intercepté : API Supabase (autre domaine), requêtes qui écrivent, le service worker lui-même', async () => {
    const sw = charger();
    expect(await sw.evenement('fetch', { request: { url: 'https://abc.supabase.co/rest/v1/rpc/x', mode: 'cors', method: 'GET' } })).toBeUndefined();
    expect(await sw.evenement('fetch', { request: sw.requete('/api/x', 'cors', 'POST') })).toBeUndefined();
    expect(await sw.evenement('fetch', { request: sw.requete('/sw.js') })).toBeUndefined();
    expect(await sw.evenement('fetch', { request: sw.requete('/donnees/liste') })).toBeUndefined();
  });
});
