import { etiquetteRabais, motifDepuisServeur, normaliserCode, verifierCodePromo } from '../codePromo';

const client = (data: unknown, error: unknown = null) => ({ rpc: jest.fn(async () => ({ data, error })) }) as never;

describe('code promo : saisie', () => {
  it('majuscules, lettres, chiffres et tiret seulement, 20 caractères au plus', () => {
    expect(normaliserCode(' elearn-20 ')).toBe('ELEARN-20');
    expect(normaliserCode('mon_code!#')).toBe('MONCODE');
    expect(normaliserCode('a'.repeat(30))).toHaveLength(20);
    expect(normaliserCode('')).toBe('');
  });

  it('badge : pourcentage ou montant dans la devise du pays', () => {
    const f = (n: number) => `${n} FCFA`;
    expect(etiquetteRabais({ type: 'pct', valeur: 20 }, f)).toBe('-20 %');
    expect(etiquetteRabais({ type: 'fixe', valeur: 500 }, f)).toBe('-500 FCFA');
  });

  it('motif du serveur : un code désactivé se montre comme inconnu, tout motif inattendu aussi', () => {
    expect(motifDepuisServeur('inactif')).toBe('inconnu');
    expect(motifDepuisServeur('expire')).toBe('expire');
    expect(motifDepuisServeur('compte_requis')).toBe('compte_requis');
    expect(motifDepuisServeur('nimporte')).toBe('inconnu');
    expect(motifDepuisServeur(undefined)).toBe('inconnu');
  });
});

describe('code promo : vérification avant paiement', () => {
  it('appelle apply_promo_code avec le code normalisé, l’offre et le pays, sans jamais envoyer de prix', async () => {
    const c = client({ valide: true, code: 'ELEARN20', type: 'pct', valeur: 20, prix_initial: 2500, prix_final: 2000, devise: 'XAF', gratuit: false });
    const r = await verifierCodePromo(c, { code: ' elearn20 ', offre: 'month', pays: 'cm' });
    expect((c as unknown as { rpc: jest.Mock }).rpc).toHaveBeenCalledWith('apply_promo_code', { p_code: 'ELEARN20', p_product: 'month', p_country: 'CM' });
    expect(r).toEqual({ valide: true, code: 'ELEARN20', type: 'pct', valeur: 20, prixInitial: 2500, prixFinal: 2000, devise: 'XAF', gratuit: false });
  });

  it('prix final à 0 : gratuit', async () => {
    const r = await verifierCodePromo(client({ valide: true, code: 'OFFERT', type: 'fixe', valeur: 500, prix_initial: 500, prix_final: 0, devise: 'XAF' }), { code: 'OFFERT', offre: 'week', pays: 'CM' });
    expect(r).toMatchObject({ valide: true, type: 'fixe', prixFinal: 0, gratuit: true });
  });

  it.each(['inconnu', 'expire', 'epuise', 'offre', 'limite'] as const)('refus « %s » renvoyé tel quel', async (erreur) => {
    const r = await verifierCodePromo(client({ valide: false, erreur }), { code: 'X1X', offre: 'month', pays: 'CM' });
    expect(r).toMatchObject({ valide: false, erreur });
  });

  it('expiré : la date du serveur est gardée ; autre offre : seules les offres connues sont gardées', async () => {
    const e = await verifierCodePromo(client({ valide: false, erreur: 'expire', expire_le: '2026-09-30' }), { code: 'OLD', offre: 'month', pays: 'CM' });
    expect(e).toMatchObject({ erreur: 'expire', expireLe: '2026-09-30' });
    const o = await verifierCodePromo(client({ valide: false, erreur: 'offre', offres_valables: ['pass_inconnu', 'contest'] }), { code: 'CONC', offre: 'month', pays: 'CM' });
    expect(o).toMatchObject({ erreur: 'offre', offresValables: ['contest'] });
  });

  it('erreur réseau ou exception : motif « reseau », jamais de levée', async () => {
    expect(await verifierCodePromo(client(null, { message: 'Network request failed' }), { code: 'X1X', offre: 'month', pays: 'CM' })).toEqual({ valide: false, erreur: 'reseau' });
    const leve = { rpc: jest.fn(async () => { throw new Error('boom'); }) } as never;
    expect(await verifierCodePromo(leve, { code: 'X1X', offre: 'month', pays: 'CM' })).toEqual({ valide: false, erreur: 'reseau' });
  });

  it('réponse illisible : traitée comme un code inconnu', async () => {
    expect(await verifierCodePromo(client({ valide: true }), { code: 'X1X', offre: 'month', pays: 'CM' })).toMatchObject({ valide: false, erreur: 'inconnu' });
    expect(await verifierCodePromo(client(null), { code: 'X1X', offre: 'month', pays: 'CM' })).toMatchObject({ valide: false, erreur: 'inconnu' });
  });
});
