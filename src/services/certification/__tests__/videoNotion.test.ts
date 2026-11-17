import { adresseVideoNotion, chargerVideoNotion, oublierVideosNotions } from '../videoNotion';

const reponse = (status: number, corps: unknown = {}) => ({ status, ok: status >= 200 && status < 300, json: async () => corps }) as Response;

describe('vidéo explicative d’une notion', () => {
  const origine = global.fetch;
  beforeEach(() => oublierVideosNotions());
  afterEach(() => {
    global.fetch = origine;
  });

  it('déduit les adresses du code de la notion, sans migration', () => {
    expect(adresseVideoNotion('g_question_wh', 'video-720.mp4')).toMatch(/\/toeic\/videos\/g_question_wh\/video-720\.mp4$/);
    expect(adresseVideoNotion('g_question_wh', 'miniature.jpg')).toMatch(/miniature\.jpg$/);
  });

  it('refuse un code qui n’est pas un code de notion', () => {
    expect(adresseVideoNotion('../secret', 'meta.json')).toBeNull();
    expect(adresseVideoNotion('A B', 'meta.json')).toBeNull();
  });

  it('meta.json présent : la vidéo existe, avec sa durée', async () => {
    global.fetch = jest.fn(async () => reponse(200, { duree: 113 })) as unknown as typeof fetch;
    const v = await chargerVideoNotion('g_question_wh');
    expect(v).toMatchObject({ code: 'g_question_wh', dureeS: 113 });
    expect(v?.url).toMatch(/video-720\.mp4$/);
    expect(v?.miniature).toMatch(/miniature\.jpg$/);
  });

  it('404 : notion sans vidéo, mémorisée', async () => {
    const f = jest.fn(async () => reponse(404));
    global.fetch = f as unknown as typeof fetch;
    expect(await chargerVideoNotion('v_hr')).toBeNull();
    expect(await chargerVideoNotion('v_hr')).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('hors ligne : aucune vidéo, et l’échec n’est pas mémorisé', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('réseau');
    }) as unknown as typeof fetch;
    expect(await chargerVideoNotion('v_hr')).toBeNull();
    const f = jest.fn(async () => reponse(200, { duree: 90 }));
    global.fetch = f as unknown as typeof fetch;
    expect((await chargerVideoNotion('v_hr'))?.dureeS).toBe(90);
  });

  it('durée absente ou invalide : null', async () => {
    global.fetch = jest.fn(async () => reponse(200, { duree: 'x' })) as unknown as typeof fetch;
    expect((await chargerVideoNotion('m_scanning'))?.dureeS).toBeNull();
  });

  it('erreur serveur : pas de vidéo, pas de mémoire', async () => {
    global.fetch = jest.fn(async () => reponse(500)) as unknown as typeof fetch;
    expect(await chargerVideoNotion('m_scanning')).toBeNull();
  });
});
