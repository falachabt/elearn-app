import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  compterTerminees,
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
  { id: 3, course_id: 42, title: 'Partie 3 — Pièges classiques', duration: 187, url: 'https://x/p3.mp4', order_index: 2, metadata: { url_1080: 'https://x/p3-1080.mp4', miniature: 'https://x/p3.jpg' } },
  { id: 1, course_id: 42, title: 'Partie 1 — Charge et champ', duration: 199, url: 'https://x/p1.mp4', order_index: 0, metadata: { url_1080: null, miniature: 'https://x/p1.jpg' } },
  { id: 2, course_id: 42, title: 'Exercices corrigés', duration: null, url: 'https://x/p2.mp4', order_index: 1, metadata: null },
];

describe('versVideos : tri, numéros et nettoyage des titres', () => {
  it('trie par order_index et numérote les parties dans cet ordre', () => {
    const videos = versVideos(LIGNES);
    expect(videos.map((v) => v.id)).toEqual([1, 2, 3]);
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
    expect(videos.map((v) => v.id)).toEqual([1, 2, 3]);
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
    const suivi = await noterPosition(7, 154.6, 242, 1000);
    expect(suivi).toEqual({ positionS: 155, dureeS: 242, terminee: false, quand: 1000 });
    expect((await lireSuivis())[7]).toEqual(suivi);
  });

  it('marque terminée à 90 % et le garde même si on relance au début', async () => {
    await noterPosition(7, 230, 242, 1000);
    expect((await lireSuivis())[7].terminee).toBe(true);
    const relance = await noterPosition(7, 0, 242, 2000);
    expect(relance.terminee).toBe(true);
    expect(relance.positionS).toBe(0);
  });

  it('marquerTerminee force l’état terminé', async () => {
    await noterPosition(7, 40, 242, 1000);
    await marquerTerminee(7, 242, 3000);
    expect((await lireSuivis())[7]).toEqual({ positionS: 242, dureeS: 242, terminee: true, quand: 3000 });
  });

  it('dernière vidéo regardée : aller-retour', async () => {
    expect(await lireDerniereVideo()).toBeNull();
    await noterDerniereVideo({ video: 7, cours: 42 }, 5000);
    expect(await lireDerniereVideo()).toEqual({ video: 7, cours: 42, quand: 5000 });
  });
});

describe('indiceCarrousel et compterTerminees', () => {
  const videos = versVideos(LIGNES) as VideoCours[];
  it('met en avant la dernière vidéo de ce cours si elle n’est pas terminée', () => {
    expect(indiceCarrousel(videos, {}, { video: 3, cours: 42, quand: 1 })).toBe(2);
    expect(indiceCarrousel(videos, { 3: { positionS: 10, dureeS: 187, terminee: false, quand: 1 } }, { video: 3, cours: 42, quand: 1 })).toBe(2);
  });
  it('revient à la Partie 1 si la dernière est terminée, d’un autre cours, ou absente', () => {
    expect(indiceCarrousel(videos, { 3: { positionS: 187, dureeS: 187, terminee: true, quand: 1 } }, { video: 3, cours: 42, quand: 1 })).toBe(0);
    expect(indiceCarrousel(videos, {}, { video: 99, cours: 7, quand: 1 })).toBe(0);
    expect(indiceCarrousel(videos, {}, null)).toBe(0);
  });
  it('compte les terminées', () => {
    expect(compterTerminees(videos, { 1: { positionS: 199, dureeS: 199, terminee: true, quand: 1 }, 3: { positionS: 5, dureeS: 187, terminee: false, quand: 1 } })).toBe(1);
  });
});
