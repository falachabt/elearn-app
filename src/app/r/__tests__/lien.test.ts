import { cibleAutorisee, DESTINATIONS } from '../lien';

describe('routeur des liens universels', () => {
  it('accepte les chemins internes connus, avec leurs paramètres', () => {
    expect(cibleAutorisee('/offres/retour?commande=abc')).toBe('/offres/retour?commande=abc');
    expect(cibleAutorisee('/offres')).toBe('/offres');
    expect(cibleAutorisee('/discussion/42')).toBe('/discussion/42');
  });

  it('refuse tout ce qui pourrait faire sortir l’application de chez elle', () => {
    // Un lien universel est public : il ne doit pas pouvoir ouvrir n'importe quoi.
    expect(cibleAutorisee('https://ailleurs.example')).toBeNull();
    expect(cibleAutorisee('//ailleurs.example')).toBeNull();
    expect(cibleAutorisee('/inconnu')).toBeNull();
    expect(cibleAutorisee('/offreseau')).toBeNull();
    expect(cibleAutorisee(undefined)).toBeNull();
    expect(cibleAutorisee(42)).toBeNull();
  });

  it('propose au moins la destination du retour de paiement', () => {
    expect(DESTINATIONS).toContain('/offres');
  });
});
