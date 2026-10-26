// Crédits sur les vidéos de cours (26/10/2026) : le service parle au serveur — action course_video,
// compteur de vidéos gratuites de découverte (my_free_videos_left), statuts renvoyés par depenser_credits.
// La logique de la gratuite (une seule, tous cours confondus, consommée à l'ouverture, ancienneté) vit
// côté serveur et se prouve en pgTAP (elearn-supabase, tests/credits/07_credits_videos.sql) ; ici on
// vérifie le branchement : bons RPC, bons paramètres, statuts transmis tels quels.
import { depenser, lireVideosGratuites } from '../credits';

jest.mock('../analytics', () => ({ suivre: jest.fn() }));

function clientFaux(rpc: { data?: unknown; error?: unknown } = {}) {
  return { rpc: jest.fn(async () => ({ data: rpc.data ?? null, error: rpc.error ?? null })) };
}

const VIDEO = '00000000-0000-0000-0000-00000000d101';

describe('lireVideosGratuites', () => {
  it('lit le compteur serveur des découvertes gratuites', async () => {
    const client = clientFaux({ data: 1 });
    await expect(lireVideosGratuites(client as never)).resolves.toBe(1);
    expect(client.rpc).toHaveBeenCalledWith('my_free_videos_left');
  });

  it('réponse non numérique : zéro, pas de gratuite annoncée à tort', async () => {
    await expect(lireVideosGratuites(clientFaux({ data: null }) as never)).resolves.toBe(0);
  });

  it('erreur du serveur : rejet, l’appelant décide', async () => {
    await expect(lireVideosGratuites(clientFaux({ error: { message: 'boom' } }) as never)).rejects.toBeTruthy();
  });
});

describe('depenser course_video', () => {
  it('première ouverture : le serveur accorde la gratuite, le statut free est transmis', async () => {
    const client = clientFaux({ data: [{ status: 'free', cost: 0, balance: 40, content: { url: 'https://exemple.test/v.mp4' } }] });
    const r = await depenser(client as never, 'course_video', VIDEO);
    expect(client.rpc).toHaveBeenCalledWith('depenser_credits', { p_action: 'course_video', p_ref: VIDEO });
    expect(r).toEqual({ statut: 'free', cout: 0, solde: 40, contenu: { url: 'https://exemple.test/v.mp4' } });
  });

  it('vidéo payée puis déjà débloquée : spent une fois, already ensuite, sans nouveau débit côté serveur', async () => {
    const payee = clientFaux({ data: [{ status: 'spent', cost: 3, balance: 37, content: { url: 'u' } }] });
    await expect(depenser(payee as never, 'course_video', VIDEO)).resolves.toMatchObject({ statut: 'spent', cout: 3, solde: 37 });
    const deja = clientFaux({ data: [{ status: 'already', cost: 0, balance: 37, content: { url: 'u' } }] });
    await expect(depenser(deja as never, 'course_video', VIDEO)).resolves.toMatchObject({ statut: 'already', cout: 0, solde: 37 });
  });

  it('pass illimité : statut unlimited, aucun coût', async () => {
    const client = clientFaux({ data: [{ status: 'unlimited', cost: 0, balance: 40, content: { url: 'u' } }] });
    await expect(depenser(client as never, 'course_video', VIDEO)).resolves.toMatchObject({ statut: 'unlimited', cout: 0 });
  });

  it('solde insuffisant : refus transmis, aucun contenu', async () => {
    const client = clientFaux({ data: [{ status: 'insufficient', cost: 3, balance: 0, content: null }] });
    await expect(depenser(client as never, 'course_video', VIDEO)).resolves.toEqual({ statut: 'insufficient', cout: 3, solde: 0, contenu: null });
  });
});
