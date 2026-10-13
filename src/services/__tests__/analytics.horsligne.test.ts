/**
 * Intégration avec le vrai SDK PostHog (aucun mock du SDK) : seuls le réseau (`fetch`) et le stockage sont simulés.
 * Vérifie la promesse hors ligne : les évènements restent dans une file locale avec leur identifiant et leur horodatage
 * d'origine, partent à la reconnexion, une seule fois, et survivent à un redémarrage de l'app.
 */
import { gunzipSync } from 'zlib';

import { analyticsActif, arreterAnalyticsPourTests, attendreAnalyticsPret, identifier, initAnalytics, reinitialiserAnalyticsPourTests, reinitialiserIdentite, suivre, vider } from '../analytics';

// Le SDK compresse les lots en gzip quand il le peut.
const lireCorps = (b: Buffer) => (b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b).toString('utf8') : b.toString('utf8'));

type Evt = { event: string; uuid: string; timestamp: string; distinct_id?: string; properties: Record<string, unknown> };

function creerReseau() {
  const etat = { enLigne: false, lots: [] as Evt[][], tentatives: 0 };
  const fetchSimule = jest.fn(async (url: string, options?: { body?: string | Blob }) => {
    if (!/\/(batch|capture|e)\/?/.test(url)) return { status: 200, text: async () => '{}', json: async () => ({}) };
    etat.tentatives += 1;
    if (!etat.enLigne) throw new TypeError('Network request failed');
    const brut = options?.body;
    const texte = typeof brut === 'string' ? brut : brut ? lireCorps(Buffer.from(await brut.arrayBuffer())) : '{}';
    const corps = JSON.parse(texte) as { batch?: Evt[] };
    if (corps.batch) etat.lots.push(corps.batch);
    return { status: 200, text: async () => '{"status":"Ok"}', json: async () => ({ status: 'Ok' }) };
  });
  globalThis.fetch = fetchSimule as unknown as typeof fetch;
  return { etat, fetchSimule };
}

function creerStockage() {
  const donnees = new Map<string, string>();
  return {
    donnees,
    stockage: {
      getItem: async (k: string) => donnees.get(k) ?? null,
      setItem: async (k: string, v: string) => {
        donnees.set(k, v);
      },
    },
  };
}

const evenementsEnvoyes = (lots: Evt[][], nom: string) => lots.flat().filter((e) => e.event === nom);

jest.setTimeout(30000);

const fetchOriginal = globalThis.fetch;

beforeEach(() => {
  reinitialiserAnalyticsPourTests();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(async () => {
  await arreterAnalyticsPourTests();
  jest.restoreAllMocks();
  globalThis.fetch = fetchOriginal;
});

describe('analytics hors ligne (vrai SDK)', () => {
  it('garde les évènements hors ligne, les envoie à la reconnexion avec leur horodatage, sans doublon', async () => {
    const reseau = creerReseau();
    const { stockage } = creerStockage();
    expect(initAnalytics({ cle: 'phc_test', hote: 'https://ph.example', stockage, reessais: { nombre: 0, delaiMs: 1 } })).toBe(true);
    expect(analyticsActif()).toBe(true);
    await attendreAnalyticsPret();

    const avant = Date.now();
    suivre('mission_started', { source: 'locale', total: 5 });
    suivre('photo_sent', { matiere: 'maths', source: 'camera' });
    suivre('button_pressed', { bouton: 'Envoyer' });
    await vider();
    expect(reseau.etat.lots).toHaveLength(0);

    // Le temps passe hors ligne : l'horodatage d'origine doit rester celui de la capture, pas celui de l'envoi.
    await new Promise((r) => setTimeout(r, 30));
    reseau.etat.enLigne = true;
    await vider();

    const envoyes = reseau.etat.lots.flat().filter((e) => ['mission_started', 'photo_sent', 'button_pressed'].includes(e.event));
    expect(envoyes.map((e) => e.event).sort()).toEqual(['button_pressed', 'mission_started', 'photo_sent']);
    for (const e of envoyes) {
      expect(typeof e.uuid).toBe('string');
      const t = new Date(e.timestamp).getTime();
      expect(t).toBeGreaterThanOrEqual(avant - 5);
      expect(t).toBeLessThan(Date.now() - 20);
    }
    expect(new Set(envoyes.map((e) => e.uuid)).size).toBe(envoyes.length);

    // Un deuxième envoi ne renvoie rien : pas de doublon.
    const lotsAvant = reseau.etat.lots.length;
    await vider();
    expect(evenementsEnvoyes(reseau.etat.lots, 'mission_started')).toHaveLength(1);
    expect(reseau.etat.lots.slice(lotsAvant).flat().filter((e) => e.event === 'mission_started')).toHaveLength(0);
  });

  it('ajoute l’écran et l’état hors ligne à chaque évènement, et retire les données personnelles', async () => {
    const reseau = creerReseau();
    reseau.etat.enLigne = true;
    const { stockage } = creerStockage();
    initAnalytics({ cle: 'phc_test', hote: 'https://ph.example', stockage, reessais: { nombre: 0, delaiMs: 1 } });
    await attendreAnalyticsPret();

    suivre('connexion_echec', { cle: 'x', code: null, message: 'échec pour marie@exemple.com au +237 612 345 678' });
    await vider();
    const e = evenementsEnvoyes(reseau.etat.lots, 'connexion_echec')[0];
    expect(e).toBeDefined();
    expect(e.properties).toHaveProperty('hors_ligne');
    expect(e.properties).toHaveProperty('ecran');
    expect(JSON.stringify(e.properties)).not.toContain('marie@exemple.com');
    expect(JSON.stringify(e.properties)).not.toContain('612 345 678');
  });

  it('survit à un redémarrage : la file hors ligne repart au prochain lancement', async () => {
    const reseau = creerReseau();
    const { stockage } = creerStockage();
    initAnalytics({ cle: 'phc_test', hote: 'https://ph.example', stockage, reessais: { nombre: 0, delaiMs: 1 } });
    await attendreAnalyticsPret();
    suivre('mission_completed', { score: 4, total: 5, duree_s: 120, serie: 3 });
    await vider();
    expect(reseau.etat.lots).toHaveLength(0);
    // Le SDK écrit sa file sur disque avec un court délai (écriture groupée) : on le laisse passer avant de « tuer » l'app.
    await new Promise((r) => setTimeout(r, 1500));

    // Redémarrage : nouvelle instance, même stockage.
    await arreterAnalyticsPourTests();
    initAnalytics({ cle: 'phc_test', hote: 'https://ph.example', stockage, reessais: { nombre: 0, delaiMs: 1 } });
    await attendreAnalyticsPret();
    reseau.etat.enLigne = true;
    await vider();

    expect(evenementsEnvoyes(reseau.etat.lots, 'mission_completed')).toHaveLength(1);
  });

  it('identifie l’utilisateur sans e-mail et rattache l’invité au compte par un alias', async () => {
    const reseau = creerReseau();
    reseau.etat.enLigne = true;
    const { stockage } = creerStockage();
    initAnalytics({ cle: 'phc_test', hote: 'https://ph.example', stockage, reessais: { nombre: 0, delaiMs: 1 } });
    await attendreAnalyticsPret();

    await identifier('invite-123', { invite: true });
    await identifier('compte-456', { invite: false });
    await vider();

    const tous = reseau.etat.lots.flat();
    const identifies = tous.filter((e) => e.event === '$identify');
    expect(identifies.map((e) => e.distinct_id ?? e.properties.distinct_id)).toEqual(expect.arrayContaining(['invite-123', 'compte-456']));
    const alias = tous.filter((e) => e.event === '$create_alias');
    expect(alias).toHaveLength(1);
    expect(alias[0].properties.alias).toBe('invite-123');
    expect(JSON.stringify(tous)).not.toMatch(/"\$?email"/);
  });

  it('déconnexion hors ligne : les évènements en attente gardent l’identité de l’élève, le suivant repart d’un nouvel invité', async () => {
    const reseau = creerReseau();
    const { stockage } = creerStockage();
    initAnalytics({ cle: 'phc_test', hote: 'https://ph.example', stockage, reessais: { nombre: 0, delaiMs: 1 } });
    await attendreAnalyticsPret();

    await identifier('compte-456', { invite: false });
    suivre('deconnexion', {});
    await reinitialiserIdentite();
    await identifier('invite-789', { invite: true });
    suivre('mission_started', { source: 'locale', total: 3 });

    reseau.etat.enLigne = true;
    await vider();
    const tous = reseau.etat.lots.flat();
    const deco = tous.find((e) => e.event === 'deconnexion');
    const mission = tous.find((e) => e.event === 'mission_started');
    expect(deco?.distinct_id ?? deco?.properties.distinct_id).toBe('compte-456');
    expect(mission?.distinct_id ?? mission?.properties.distinct_id).toBe('invite-789');
    // Aucun alias entre un compte et le visiteur suivant : deux personnes différentes.
    expect(tous.filter((e) => e.event === '$create_alias')).toHaveLength(0);
  });
});
