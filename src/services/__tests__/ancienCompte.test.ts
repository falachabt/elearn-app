import { suivre } from '../analytics';
import { INDICATIFS, lienSupport, normaliserTelephone, retrouverAncienCompte, validerTelephone } from '../ancienCompte';

jest.mock('../analytics', () => ({ suivre: jest.fn() }));

const client = (resultat: { data?: unknown; error?: unknown }) => ({
  auth: { signInWithPassword: jest.fn().mockResolvedValue({ data: { session: null }, error: null, ...resultat }) },
});

beforeEach(() => jest.clearAllMocks());

describe('numéro de l’ancien compte', () => {
  it('même format que l’ancienne app : indicatif ajouté, espaces retirés, + ou indicatif gardés', () => {
    expect(normaliserTelephone('677 12 34 56')).toBe('+237677123456');
    expect(normaliserTelephone('237677123456')).toBe('+237677123456');
    expect(normaliserTelephone('+237 677-12-34-56')).toBe('+237677123456');
    expect(normaliserTelephone('07 08 09 10 11', INDICATIFS.CI)).toBe('+2250708091011');
    expect(normaliserTelephone('  ')).toBe('');
  });

  it('validation : vide, trop court, correct', () => {
    expect(validerTelephone('')).toBe('ancien.erreurs.telephoneVide');
    expect(validerTelephone('123')).toBe('ancien.erreurs.telephoneInvalide');
    expect(validerTelephone('677 12 34 56')).toBeNull();
  });
});

describe('retrouverAncienCompte', () => {
  it('connexion téléphone + mot de passe avec le numéro normalisé', async () => {
    const session = { user: { id: 'ancien' } };
    const c = client({ data: { session } });
    await expect(retrouverAncienCompte(c as never, { telephone: '677 12 34 56', motDePasse: 'secret12' })).resolves.toBe(session);
    expect(c.auth.signInWithPassword).toHaveBeenCalledWith({ phone: '+237677123456', password: 'secret12' });
    expect(suivre).toHaveBeenCalledWith('connexion_reussie', { methode: 'telephone' });
  });

  it('identifiants faux : message dédié qui oriente vers le support', async () => {
    const c = client({ error: { code: 'invalid_credentials', message: 'Invalid login credentials' } });
    await expect(retrouverAncienCompte(c as never, { telephone: '677123456', motDePasse: 'x' })).rejects.toMatchObject({ cle: 'ancien.erreurs.identifiants' });
    expect(suivre).not.toHaveBeenCalled();
  });

  it('connexion par téléphone désactivée côté serveur : méthode indisponible', async () => {
    const c = client({ error: { code: 'phone_provider_disabled', message: 'Phone logins are disabled' } });
    await expect(retrouverAncienCompte(c as never, { telephone: '677123456', motDePasse: 'x' })).rejects.toMatchObject({ cle: 'compte.erreurs.methodeIndisponible' });
  });
});

it('lien WhatsApp du support avec message encodé', () => {
  expect(lienSupport('Bonjour, mon numéro : 677')).toBe('https://wa.me/12015348324?text=Bonjour%2C%20mon%20num%C3%A9ro%20%3A%20677');
});
