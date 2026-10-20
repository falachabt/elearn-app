import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  MAX_FEUILLES,
  PREFERENCE_TEMPS_DEFAUT,
  ajouterFeuilles,
  definirBrouillon,
  deplacerFeuille,
  dureeDemarrage,
  dureeLisible,
  enregistrerPreferenceTemps,
  envoyerTravail,
  etatsEtapesTravail,
  pivoterFeuille,
  recadrerFeuille,
  remplacerFeuille,
  QUALITE_FEUILLE,
  preparerFeuille,
  issueDe,
  libelleNote,
  libellePoints,
  lireBrouillon,
  lireLignes,
  lirePreferenceTemps,
  lireSessions,
  majFeuilles,
  minutesValides,
  niveauNote,
  niveauPoints,
  nouvelleFeuille,
  preferenceCoherente,
  reprendreSession,
  retirerFeuille,
  sessionDepuis,
  type Feuille,
} from '../travailSujet';

const mockFetch = jest.fn();
jest.mock('expo/fetch', () => ({ fetch: (...a: unknown[]) => mockFetch(...a) }));
const mockManip = { rotate: jest.fn(), crop: jest.fn(), renderAsync: jest.fn(), saveAsync: jest.fn() };
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: () => mockManip }, SaveFormat: { JPEG: 'jpeg' } }));
jest.mock('../photo', () => ({
  preparerImage: jest.fn(async () => ({ base64: 'AAAA' })),
  cadrePixels: (c: { x: number; y: number; largeur: number; hauteur: number }, l: number, h: number) => ({ x: Math.round(c.x * l), y: Math.round(c.y * h), largeur: Math.round(c.largeur * l), hauteur: Math.round(c.hauteur * h) }),
}));

const feuille = (n: number): Feuille => ({ id: `f${n}`, uri: `file:///${n}.jpg`, largeur: 100, hauteur: 200 });
const liste = (n: number) => Array.from({ length: n }, (_, i) => feuille(i + 1));
const ids = (l: Feuille[]) => l.map((f) => f.id).join(',');

describe('feuilles : ajout, ordre, retrait', () => {
  it('ajoute à la suite et refuse au-delà du maximum', () => {
    const r = ajouterFeuilles(liste(MAX_FEUILLES - 1), [feuille(90), feuille(91), feuille(92)]);
    expect(r.liste).toHaveLength(MAX_FEUILLES);
    expect(r.refusees).toBe(2);
    expect(ajouterFeuilles([], [feuille(1)]).refusees).toBe(0);
  });

  it('les feuilles créées ont des identifiants distincts', () => {
    const a = nouvelleFeuille({ uri: 'a', largeur: 1, hauteur: 1 });
    const b = nouvelleFeuille({ uri: 'a', largeur: 1, hauteur: 1 });
    expect(a.id).not.toBe(b.id);
  });

  it('déplace vers le haut, vers le bas, borne aux extrémités et ne touche pas la liste d’origine', () => {
    const l = liste(4);
    expect(ids(deplacerFeuille(l, 2, 1))).toBe('f1,f3,f2,f4');
    expect(ids(deplacerFeuille(l, 1, 2))).toBe('f1,f3,f2,f4');
    expect(ids(deplacerFeuille(l, 0, -1))).toBe('f1,f2,f3,f4');
    expect(ids(deplacerFeuille(l, 3, 99))).toBe('f1,f2,f3,f4');
    expect(ids(deplacerFeuille(l, 0, 9))).toBe('f2,f3,f4,f1');
    expect(ids(deplacerFeuille(l, 7, 0))).toBe('f1,f2,f3,f4');
    expect(ids(l)).toBe('f1,f2,f3,f4');
  });

  it('retire une feuille', () => {
    expect(ids(retirerFeuille(liste(3), 1))).toBe('f1,f3');
  });

  it('brouillon : majFeuilles ne fait rien sans brouillon, sinon applique', () => {
    definirBrouillon(null);
    majFeuilles((f) => [...f, feuille(1)]);
    expect(lireBrouillon()).toBeNull();
    definirBrouillon({ kind: 'exam', ref: '1', titre: 'T', matiere: null, tempsS: null, feuilles: [] });
    majFeuilles((f) => [...f, feuille(1)]);
    expect(lireBrouillon()?.feuilles).toHaveLength(1);
    definirBrouillon(null);
  });
});

describe('note et points', () => {
  it('formate avec la virgule', () => {
    expect(libelleNote(14, 20)).toBe('14/20');
    expect(libelleNote(7.5, 12)).toBe('7,5/12');
    expect(libellePoints(0.25, 1)).toBe('0,25/1');
  });

  it('niveaux de points et de note', () => {
    expect(niveauPoints(0, 3)).toBe('nul');
    expect(niveauPoints(1, 3)).toBe('partiel');
    expect(niveauPoints(3, 3)).toBe('plein');
    expect(niveauNote(12, 20)).toBe('bonne');
    expect(niveauNote(8, 20)).toBe('moyenne');
    expect(niveauNote(7, 20)).toBe('faible');
    expect(niveauNote(0, 0)).toBe('faible');
  });

  it('durée lisible', () => {
    expect(dureeLisible(20)).toBe('1 min');
    expect(dureeLisible(45 * 60)).toBe('45 min');
    expect(dureeLisible(112 * 60)).toBe('1 h 52');
    expect(dureeLisible(3600)).toBe('1 h 00');
  });
});

describe('temps de travail choisi', () => {
  it('minutes valides : entier de 1 à 600', () => {
    expect(minutesValides('90')).toBe(90);
    expect(minutesValides(' 600 ')).toBe(600);
    for (const mauvais of ['', '0', '601', '1.5', 'abc', '-3', '1000']) expect(minutesValides(mauvais)).toBeNull();
  });

  it('valeur transmise au lecteur', () => {
    expect(dureeDemarrage({ mode: 'libre', choix: 'conseille', minutes: '' }, 180)).toBe('libre');
    expect(dureeDemarrage({ mode: 'compte', choix: 'conseille', minutes: '' }, 180)).toBe('10800');
    expect(dureeDemarrage({ mode: 'compte', choix: 'conseille', minutes: '' }, null)).toBeNull();
    expect(dureeDemarrage({ mode: 'compte', choix: 'perso', minutes: '45' }, 180)).toBe('2700');
    expect(dureeDemarrage({ mode: 'compte', choix: 'perso', minutes: '' }, 180)).toBeNull();
  });

  it('sans temps conseillé : « Mon temps » si un temps est déjà saisi, sinon chrono libre', () => {
    expect(preferenceCoherente(PREFERENCE_TEMPS_DEFAUT, null).mode).toBe('libre');
    expect(preferenceCoherente({ mode: 'compte', choix: 'conseille', minutes: '45' }, null)).toMatchObject({ mode: 'compte', choix: 'perso' });
    expect(preferenceCoherente(PREFERENCE_TEMPS_DEFAUT, 120).choix).toBe('conseille');
    expect(preferenceCoherente({ mode: 'libre', choix: 'conseille', minutes: '' }, null).mode).toBe('libre');
  });

  it('préférence mémorisée, valeurs invalides ignorées', async () => {
    await AsyncStorage.clear();
    expect(await lirePreferenceTemps()).toEqual(PREFERENCE_TEMPS_DEFAUT);
    await enregistrerPreferenceTemps({ mode: 'compte', choix: 'perso', minutes: '75' });
    expect(await lirePreferenceTemps()).toEqual({ mode: 'compte', choix: 'perso', minutes: '75' });
    await AsyncStorage.setItem('annales.temps.preference', JSON.stringify({ mode: 'libre', choix: 'x', minutes: '9999' }));
    expect(await lirePreferenceTemps()).toEqual({ mode: 'libre', choix: 'conseille', minutes: '' });
    await AsyncStorage.setItem('annales.temps.preference', '{pas du json');
    expect(await lirePreferenceTemps()).toEqual(PREFERENCE_TEMPS_DEFAUT);
  });
});

describe('flux de correction', () => {
  const resultat = { questions: [{ n: '1', titre: 'Q1', points: 2, max: 3, commentaire: 'ok' }], resume: 'bien' };

  it('lit les lignes complètes et garde le reste', () => {
    const r = lireLignes('{"t":"etape","etape":"envoi"}\n\nnon json\n{"t":"etape","etape":"corr');
    expect(r.evenements).toEqual([{ t: 'etape', etape: 'envoi' }]);
    expect(r.reste).toBe('{"t":"etape","etape":"corr');
  });

  it('issue d’un évènement', () => {
    expect(issueDe({ t: 'etape', etape: 'envoi' })).toBeNull();
    expect(issueDe({ t: 'erreur', code: 'x' })).toEqual({ type: 'erreur' });
    expect(issueDe({ t: 'illisible', id: 'a', raison: 'flou' })).toEqual({ type: 'illisible', raison: 'flou' });
    expect(issueDe({ t: 'fin', id: 'a', score: 2, total: 3, resultat })).toMatchObject({ type: 'fin', score: 2 });
  });

  it('états des étapes', () => {
    expect(etatsEtapesTravail([])).toEqual(['en_cours', 'attente', 'attente']);
    expect(etatsEtapesTravail([], true)).toEqual(['echec', 'attente', 'attente']);
    expect(etatsEtapesTravail(['envoi', 'correction'], true)).toEqual(['fait', 'echec', 'attente']);
    expect(etatsEtapesTravail(['envoi'])).toEqual(['en_cours', 'attente', 'attente']);
    expect(etatsEtapesTravail(['envoi', 'correction'])).toEqual(['fait', 'en_cours', 'attente']);
    expect(etatsEtapesTravail(['envoi', 'correction', 'notation'])).toEqual(['fait', 'fait', 'en_cours']);
  });

  const client = (jeton: string | null = 'jeton', ligne: unknown = null) =>
    ({
      auth: { getSession: async () => ({ data: { session: jeton ? { access_token: jeton } : null } }) },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: ligne, error: null }) }) }) }),
    }) as never;
  const options = (surEtape = jest.fn()) => ({ kind: 'exam' as const, ref: '1', pages: ['AAAA'], titre: 'T', matiere: 'Maths', tempsS: 120, surEtape });
  const reponse = (statut: number, corps = '', json: unknown = {}) => ({
    status: statut,
    ok: statut >= 200 && statut < 300,
    headers: { get: () => 's1' },
    body: null,
    text: async () => corps,
    json: async () => json,
  });

  beforeEach(() => mockFetch.mockReset());

  it('succès : étapes signalées puis note', async () => {
    const surEtape = jest.fn();
    mockFetch.mockResolvedValue(
      reponse(200, ['{"t":"etape","etape":"envoi"}', '{"t":"etape","etape":"correction"}', JSON.stringify({ t: 'fin', id: 's1', score: 2, total: 3, resultat })].join('\n')),
    );
    const issue = await envoyerTravail(client(), options(surEtape));
    expect(issue).toMatchObject({ type: 'fin', id: 's1', score: 2, total: 3 });
    expect(surEtape).toHaveBeenNthCalledWith(1, 'envoi');
    expect(surEtape).toHaveBeenNthCalledWith(2, 'correction');
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer jeton');
    expect(JSON.parse(init.body)).toMatchObject({ kind: 'exam', ref: '1', pages: ['AAAA'], time_spent_s: 120 });
  });

  it('pas de session : erreur sans appel réseau', async () => {
    expect(await envoyerTravail(client(null), options())).toEqual({ type: 'erreur' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('refus du serveur : crédits, quota, limite de cadence, erreur', async () => {
    mockFetch.mockResolvedValueOnce(reponse(402));
    expect(await envoyerTravail(client(), options())).toEqual({ type: 'credits' });
    mockFetch.mockResolvedValueOnce(reponse(429, '', { code: 'quota' }));
    expect(await envoyerTravail(client(), options())).toEqual({ type: 'quota' });
    mockFetch.mockResolvedValueOnce(reponse(429, '', { code: 'limite', reessayez_dans_minutes: 12 }));
    expect(await envoyerTravail(client(), options())).toEqual({ type: 'limite', minutes: 12 });
    mockFetch.mockResolvedValueOnce(reponse(500));
    expect(await envoyerTravail(client(), options())).toEqual({ type: 'erreur' });
  });

  it('sans réseau : hors ligne', async () => {
    mockFetch.mockRejectedValue(new Error('Network request failed'));
    expect(await envoyerTravail(client(), options())).toEqual({ type: 'hors-ligne' });
  });

  it('photo illisible et flux sans issue', async () => {
    mockFetch.mockResolvedValueOnce(reponse(200, '{"t":"illisible","id":"s1","raison":"flou"}'));
    expect(await envoyerTravail(client(), options())).toEqual({ type: 'illisible', raison: 'flou' });
    mockFetch.mockResolvedValueOnce(reponse(200, '{"t":"etape","etape":"envoi"}'));
    expect(await envoyerTravail(client(), options())).toEqual({ type: 'erreur' });
  });

  it('coupure en cours de flux : la session est relue', async () => {
    mockFetch.mockResolvedValue({
      ...reponse(200),
      body: { getReader: () => ({ read: async () => { throw new Error('coupé'); } }) },
    });
    const ligne = { id: 's1', status: 'done', score: 2, max_score: 3, page_count: 1, time_spent_s: null, created_at: '2026-10-20', result: resultat, images_purged_at: null };
    expect(await envoyerTravail(client('jeton', ligne), options())).toMatchObject({ type: 'fin', id: 's1' });
    expect(await envoyerTravail(client('jeton', null), options())).toEqual({ type: 'hors-ligne' });
  });

  it('reprise d’une session selon son statut', async () => {
    const base = { id: 's1', score: null, max_score: null, page_count: 1, time_spent_s: null, created_at: 'd', result: null, images_purged_at: null };
    expect(await reprendreSession(client('j', { ...base, status: 'pending' }), 's1')).toBeNull();
    expect(await reprendreSession(client('j', { ...base, status: 'unreadable' }), 's1')).toEqual({ type: 'illisible', raison: '' });
    expect(await reprendreSession(client('j', { ...base, status: 'failed' }), 's1')).toEqual({ type: 'erreur' });
  });
});

describe('sessions', () => {
  it('convertit une ligne : note, feuilles effacées, résultat seulement si terminée', () => {
    const base = { id: 's', page_count: 3, time_spent_s: 600, created_at: 'd', result: { questions: [], resume: 'r' }, images_purged_at: '2026-11-01' };
    expect(sessionDepuis({ ...base, status: 'done', score: '14.5' as unknown as number, max_score: 20 })).toMatchObject({ score: 14.5, total: 20, feuilles: 3, tempsS: 600, feuillesEffacees: true });
    expect(sessionDepuis({ ...base, status: 'pending', score: null, max_score: null }).resultat).toBeNull();
  });

  it('lit les sessions terminées du sujet, les plus récentes d’abord', async () => {
    const appels: unknown[][] = [];
    const chaine: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit']) chaine[m] = (...a: unknown[]) => { appels.push([m, ...a]); return m === 'limit' ? Promise.resolve({ data: [{ id: 's', status: 'done', score: 1, max_score: 2, page_count: 1, time_spent_s: null, created_at: 'd', result: null, images_purged_at: null }], error: null }) : chaine; };
    const l = await lireSessions({ from: () => chaine } as never, 'document', 'd1');
    expect(l).toHaveLength(1);
    expect(appels).toContainEqual(['eq', 'paper_kind', 'document']);
    expect(appels).toContainEqual(['eq', 'paper_ref', 'd1']);
    expect(appels).toContainEqual(['eq', 'status', 'done']);
    expect(appels).toContainEqual(['order', 'created_at', { ascending: false }]);
  });

  it('erreur serveur propagée', async () => {
    const chaine: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit']) chaine[m] = () => (m === 'limit' ? Promise.resolve({ data: null, error: new Error('x') }) : chaine);
    await expect(lireSessions({ from: () => chaine } as never, 'exam', '1')).rejects.toThrow('x');
  });
});

describe('retouche des feuilles (aperçu)', () => {
  beforeEach(() => {
    mockManip.rotate.mockReturnValue(mockManip);
    mockManip.crop.mockReturnValue(mockManip);
    mockManip.renderAsync.mockResolvedValue(mockManip);
    mockManip.saveAsync.mockResolvedValue({ uri: 'file:///neuf.jpg' });
  });

  it('pivoter échange largeur et hauteur et change l’adresse', async () => {
    const r = await pivoterFeuille(feuille(1));
    expect(mockManip.rotate).toHaveBeenCalledWith(90);
    expect(r).toEqual({ uri: 'file:///neuf.jpg', largeur: 200, hauteur: 100 });
  });

  it('recadrer rogne en pixels et renvoie la nouvelle taille', async () => {
    const r = await recadrerFeuille(feuille(1), { x: 0.1, y: 0.1, largeur: 0.5, hauteur: 0.5 });
    expect(mockManip.crop).toHaveBeenCalledWith({ originX: 10, originY: 20, width: 50, height: 100 });
    expect(r).toEqual({ uri: 'file:///neuf.jpg', largeur: 50, hauteur: 100 });
  });

  it('remplacer garde l’identifiant et la place', () => {
    const l = remplacerFeuille(liste(3), 'f2', { uri: 'x', largeur: 1, hauteur: 2 });
    expect(l.map((f) => f.id)).toEqual(['f1', 'f2', 'f3']);
    expect(l[1]).toEqual({ id: 'f2', uri: 'x', largeur: 1, hauteur: 2 });
  });

  it('les feuilles envoyées sont plus fines qu’une photo d’aide', async () => {
    const { preparerImage } = jest.requireMock('../photo') as { preparerImage: jest.Mock };
    await preparerFeuille(feuille(1));
    expect(preparerImage).toHaveBeenCalledWith('file:///1.jpg', { x: 0, y: 0, largeur: 1, hauteur: 1 }, 100, 200, QUALITE_FEUILLE);
    expect(QUALITE_FEUILLE.coteMax).toBeGreaterThan(1280);
  });
});
