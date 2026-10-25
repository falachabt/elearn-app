import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  compterTerminees,
  fusionnerSuivis,
  lignesAEnvoyer,
  synchroniserSuivis,
  estTerminee,
  formaterDuree,
  indiceCarrousel,
  lireDerniereVideo,
  lireSuivis,
  lireVideos,
  marquerTerminee,
  noterDerniereVideo,
  noterPosition,
  titreSansPartie,
  versVideos,
  type VideoCours,
} from '../videos';

const LIGNES = [
  { id: 'v3', course_id: 42, title: 'Partie 3 — Pièges classiques', duration: 187, url: 'https://x/p3.mp4', order_index: 2, metadata: { url_1080: 'https://x/p3-1080.mp4', miniature: 'https://x/p3.jpg' } },
  { id: 'v1', course_id: 42, title: 'Partie 1 — Charge et champ', duration: 199, url: 'https://x/p1.mp4', order_index: 0, metadata: { url_1080: null, miniature: 'https://x/p1.jpg' } },
  { id: 'v2', course_id: 42, title: 'Exercices corrigés', duration: null, url: 'https://x/p2.mp4', order_index: 1, metadata: null },
];

describe('versVideos : tri, numéros et nettoyage des titres', () => {
  it('trie par order_index et numérote les parties dans cet ordre', () => {
    const videos = versVideos(LIGNES);
    expect(videos.map((v) => v.id)).toEqual(['v1', 'v2', 'v3']);
    expect(videos.map((v) => v.numero)).toEqual([1, 2, 3]);
  });

  it('retire le préfixe « Partie N — » du titre, gardé dans le numéro', () => {
    const videos = versVideos(LIGNES);
    expect(videos[0].titre).toBe('Charge et champ');
    expect(videos[2].titre).toBe('Pièges classiques');
    // Un titre sans préfixe (vidéo d'exercices du back-office) reste tel quel.
    expect(videos[1].titre).toBe('Exercices corrigés');
  });

  it('expose la miniature, le 1080p et la durée des métadonnées', () => {
    const videos = versVideos(LIGNES);
    expect(videos[0]).toMatchObject({ miniature: 'https://x/p1.jpg', url1080: null, dureeS: 199, url: 'https://x/p1.mp4' });
    expect(videos[2]).toMatchObject({ miniature: 'https://x/p3.jpg', url1080: 'https://x/p3-1080.mp4' });
    expect(videos[1]).toMatchObject({ miniature: null, url1080: null, dureeS: null });
  });
});

describe('titreSansPartie', () => {
  it.each([
    ['Partie 1 — Charge, champ, potentiel', 'Charge, champ, potentiel'],
    ['Partie 2 – Les pièges', 'Les pièges'],
    ['partie 10 : Synthèse', 'Synthèse'],
    ['  Partie 3 — Régime transitoire  ', 'Régime transitoire'],
    ['Introduction aux composés', 'Introduction aux composés'],
    ['Partie intégrante du cours', 'Partie intégrante du cours'],
  ])('%s → %s', (avant, apres) => {
    expect(titreSansPartie(avant)).toBe(apres);
  });
});

describe('lireVideos', () => {
  it('ne demande que les vidéos ready du cours, triées par order_index', async () => {
    const appels: Record<string, unknown>[] = [];
    const chaine = {
      select: () => chaine,
      eq: (colonne: string, valeur: unknown) => {
        appels.push({ colonne, valeur });
        return chaine;
      },
      order: async (colonne: string, options: unknown) => {
        appels.push({ colonne, options });
        return { data: LIGNES, error: null };
      },
    };
    const client = { from: (table: string) => (appels.push({ table }), chaine) };
    const videos = await lireVideos(client as never, 42);
    expect(appels[0]).toEqual({ table: 'course_videos' });
    expect(appels).toContainEqual({ colonne: 'course_id', valeur: 42 });
    expect(appels).toContainEqual({ colonne: 'status', valeur: 'ready' });
    expect(appels).toContainEqual({ colonne: 'order_index', options: { ascending: true } });
    expect(videos.map((v) => v.id)).toEqual(['v1', 'v2', 'v3']);
  });
});

describe('estTerminee et formaterDuree', () => {
  it('seuil à 90 %', () => {
    expect(estTerminee(89, 100)).toBe(false);
    expect(estTerminee(90, 100)).toBe(true);
    expect(estTerminee(100, 100)).toBe(true);
    expect(estTerminee(50, null)).toBe(false);
    expect(estTerminee(50, 0)).toBe(false);
  });
  it('formate en m:ss', () => {
    expect(formaterDuree(199)).toBe('3:19');
    expect(formaterDuree(65)).toBe('1:05');
    expect(formaterDuree(0)).toBe('0:00');
    expect(formaterDuree(null)).toBe('');
  });
});

describe('suivi local : positions et reprise', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('note une position et la relit', async () => {
    const suivi = await noterPosition('v7', 42, 154.6, 242, 1000);
    expect(suivi).toEqual({ positionS: 155, dureeS: 242, terminee: false, quand: 1000, cours: 42 });
    expect((await lireSuivis())['v7']).toEqual(suivi);
  });

  it('marque terminée à 90 % et le garde même si on relance au début', async () => {
    await noterPosition('v7', 42, 230, 242, 1000);
    expect((await lireSuivis())['v7'].terminee).toBe(true);
    const relance = await noterPosition('v7', 42, 0, 242, 2000);
    expect(relance.terminee).toBe(true);
    expect(relance.positionS).toBe(0);
  });

  it('marquerTerminee force l’état terminé', async () => {
    await noterPosition('v7', 42, 40, 242, 1000);
    await marquerTerminee('v7', 42, 242, 3000);
    expect((await lireSuivis())['v7']).toEqual({ positionS: 242, dureeS: 242, terminee: true, quand: 3000, cours: 42 });
  });

  it('dernière vidéo regardée : aller-retour', async () => {
    expect(await lireDerniereVideo()).toBeNull();
    await noterDerniereVideo({ video: 'v7', cours: 42 }, 5000);
    expect(await lireDerniereVideo()).toEqual({ video: 'v7', cours: 42, quand: 5000 });
  });
});

describe('indiceCarrousel et compterTerminees', () => {
  const videos = versVideos(LIGNES) as VideoCours[];
  it('met en avant la dernière vidéo de ce cours si elle n’est pas terminée', () => {
    expect(indiceCarrousel(videos, {}, { video: 'v3', cours: 42, quand: 1 })).toBe(2);
    expect(indiceCarrousel(videos, { v3: { positionS: 10, dureeS: 187, terminee: false, quand: 1, cours: 42 } }, { video: 'v3', cours: 42, quand: 1 })).toBe(2);
  });
  it('revient à la Partie 1 si la dernière est terminée, d’un autre cours, ou absente', () => {
    expect(indiceCarrousel(videos, { v3: { positionS: 187, dureeS: 187, terminee: true, quand: 1, cours: 42 } }, { video: 'v3', cours: 42, quand: 1 })).toBe(0);
    expect(indiceCarrousel(videos, {}, { video: 'v99', cours: 7, quand: 1 })).toBe(0);
    expect(indiceCarrousel(videos, {}, null)).toBe(0);
  });
  it('compte les terminées', () => {
    expect(compterTerminees(videos, { v1: { positionS: 199, dureeS: 199, terminee: true, quand: 1, cours: 42 }, v3: { positionS: 5, dureeS: 187, terminee: false, quand: 1, cours: 42 } })).toBe(1);
  });
});

describe('synchronisation serveur (lot 2)', () => {
  const ligne = (video: string, quandMs: number, position = 30) => ({
    video_id: video,
    course_id: 42,
    position_s: position,
    duree_s: 242,
    terminee: false,
    derniere_vue: new Date(quandMs).toISOString(),
  });

  it('fusion : la plus récente gagne, dans les deux sens', () => {
    const locaux = {
      v1: { positionS: 10, dureeS: 242, terminee: false, quand: 1000, cours: 42 },
      v2: { positionS: 90, dureeS: 242, terminee: false, quand: 5000, cours: 42 },
    };
    const fusion = fusionnerSuivis(locaux, [ligne('v1', 2000, 60), ligne('v2', 3000, 20), ligne('v3', 4000, 5)]);
    expect(fusion.v1.positionS).toBe(60); // serveur plus récent
    expect(fusion.v2.positionS).toBe(90); // local plus récent
    expect(fusion.v3.positionS).toBe(5); // nouvelle du serveur
  });

  it('lignes à envoyer : absentes ou plus récentes que le serveur, cours connu seulement', () => {
    const locaux = {
      v1: { positionS: 10, dureeS: 242, terminee: false, quand: 1000, cours: 42 },
      v2: { positionS: 90, dureeS: 242, terminee: false, quand: 5000, cours: 42 },
      v3: { positionS: 5, dureeS: 242, terminee: false, quand: 9000, cours: 0 },
    };
    const envois = lignesAEnvoyer(locaux, [ligne('v1', 2000), ligne('v2', 3000)], 'u1');
    expect(envois.map((l) => l.video_id)).toEqual(['v2']);
    expect(envois[0]).toMatchObject({ user_id: 'u1', course_id: 42, position_s: 90 });
  });

  it('synchroniserSuivis : pousse les locales plus récentes et fusionne dans le local', async () => {
    await AsyncStorage.clear();
    await noterPosition('v2', 42, 90, 242, 5000);
    const upserts: unknown[] = [];
    const chaine = {
      select: async () => ({ data: [ligne('v1', 2000, 60), ligne('v2', 3000, 20)], error: null }),
      upsert: async (lignes: unknown) => (upserts.push(lignes), { error: null }),
    };
    const client = {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
      from: () => chaine,
    };
    const fusion = await synchroniserSuivis(client as never);
    expect(fusion.v1.positionS).toBe(60);
    expect(fusion.v2.positionS).toBe(90);
    expect(upserts).toHaveLength(1);
    expect((upserts[0] as { video_id: string }[]).map((l) => l.video_id)).toEqual(['v2']);
    expect((await lireSuivis()).v1.positionS).toBe(60);
  });

  it('synchroniserSuivis sans session : le local est rendu tel quel', async () => {
    await AsyncStorage.clear();
    await noterPosition('v2', 42, 90, 242, 5000);
    const client = { auth: { getSession: async () => ({ data: { session: null } }) }, from: () => { throw new Error('ne doit pas être appelé'); } };
    const fusion = await synchroniserSuivis(client as never);
    expect(fusion.v2.positionS).toBe(90);
  });
});
