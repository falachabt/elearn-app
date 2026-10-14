import { mesurerFetch, nommerRequete, reinitialiserMesureReseauPourTests } from '../mesureReseau';

const mockSuivre = jest.fn();
const mockEcran = jest.fn<string | null, []>();

jest.mock('../analytics', () => ({
  suivre: (...args: unknown[]) => mockSuivre(...args),
  lireEcranCourant: () => mockEcran(),
}));

function reponse(status: number, contentLength?: string): Response {
  const entetes = new Headers();
  if (contentLength !== undefined) entetes.set('content-length', contentLength);
  return new Response(null, { status, headers: entetes });
}

describe('nommerRequete', () => {
  it('nomme les tables, les RPC, les fonctions et l’auth sans les paramètres', () => {
    expect(nommerRequete('https://x.supabase.co/rest/v1/cours?select=*&id=eq.42')).toBe('table:cours');
    expect(nommerRequete('https://x.supabase.co/rest/v1/rpc/depenser_credits')).toBe('rpc:depenser_credits');
    expect(nommerRequete('https://x.supabase.co/functions/v1/correction-photo')).toBe('fonction:correction-photo');
    expect(nommerRequete('https://x.supabase.co/auth/v1/token?grant_type=password')).toBe('auth:token');
    expect(nommerRequete('https://x.supabase.co/storage/v1/object/public/bucket/fichier.pdf')).toBe('storage');
  });

  it('ne laisse jamais passer une saisie ou un identifiant de l’URL', () => {
    expect(nommerRequete('https://x.supabase.co/rest/v1/users?email=eq.eleve@exemple.fr')).toBe('table:users');
  });

  it('renvoie autre pour une URL illisible ou inconnue', () => {
    expect(nommerRequete('pas une url')).toBe('autre');
    expect(nommerRequete('https://exemple.fr/ailleurs')).toBe('autre');
  });
});

describe('mesurerFetch', () => {
  beforeEach(() => {
    mockSuivre.mockReset();
    mockEcran.mockReset();
    mockEcran.mockReturnValue('accueil');
    reinitialiserMesureReseauPourTests();
  });

  it('envoie requete_reseau avec durée, statut et octets, et renvoie la réponse telle quelle', async () => {
    const attendue = reponse(200, '1234');
    const original = jest.fn().mockResolvedValue(attendue);
    const fetchMesure = mesurerFetch(original);

    const corps = JSON.stringify({ titre: 'bonjour' });
    const recue = await fetchMesure('https://x.supabase.co/rest/v1/cours?select=*', { method: 'POST', body: corps });

    expect(recue).toBe(attendue);
    expect(original).toHaveBeenCalledWith('https://x.supabase.co/rest/v1/cours?select=*', { method: 'POST', body: corps });
    expect(mockSuivre).toHaveBeenCalledWith(
      'requete_reseau',
      expect.objectContaining({ nom: 'table:cours', statut: 200, octets_envoyes: corps.length, octets_recus: 1234 }),
    );
  });

  it('met octets_recus à null sans content-length', async () => {
    const fetchMesure = mesurerFetch(jest.fn().mockResolvedValue(reponse(200)));
    await fetchMesure('https://x.supabase.co/rest/v1/cours');
    expect(mockSuivre).toHaveBeenCalledWith('requete_reseau', expect.objectContaining({ octets_recus: null, octets_envoyes: 0 }));
  });

  it('envoie requete_reseau avec statut 0 puis relance l’erreur réseau', async () => {
    const erreur = new TypeError('Network request failed');
    const fetchMesure = mesurerFetch(jest.fn().mockRejectedValue(erreur));
    await expect(fetchMesure('https://x.supabase.co/rest/v1/cours')).rejects.toBe(erreur);
    expect(mockSuivre).toHaveBeenCalledWith('requete_reseau', expect.objectContaining({ nom: 'table:cours', statut: 0 }));
  });

  it('envoie ecran_pret une seule fois par écran, au premier succès', async () => {
    const fetchMesure = mesurerFetch(jest.fn().mockResolvedValue(reponse(200)));

    await fetchMesure('https://x.supabase.co/rest/v1/cours');
    await fetchMesure('https://x.supabase.co/rest/v1/cours');
    const pretes = mockSuivre.mock.calls.filter(([nom]) => nom === 'ecran_pret');
    expect(pretes).toHaveLength(1);
    expect(pretes[0][1]).toEqual({ ecran_cible: 'accueil', duration_ms: expect.any(Number) });
  });

  it('ne compte pas ecran_pret sur une réponse en erreur', async () => {
    const fetchMesure = mesurerFetch(jest.fn().mockResolvedValue(reponse(500)));
    await fetchMesure('https://x.supabase.co/rest/v1/cours');
    expect(mockSuivre.mock.calls.some(([nom]) => nom === 'ecran_pret')).toBe(false);
  });

  it('ne casse jamais la requête si la mesure échoue', async () => {
    mockSuivre.mockImplementation(() => {
      throw new Error('analytics en panne');
    });
    const attendue = reponse(200);
    const fetchMesure = mesurerFetch(jest.fn().mockResolvedValue(attendue));
    await expect(fetchMesure('https://x.supabase.co/rest/v1/cours')).resolves.toBe(attendue);
  });
});
