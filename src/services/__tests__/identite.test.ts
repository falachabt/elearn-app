import { identiteDe } from '../identite';

describe('identité du compte', () => {
  it('Google : nom complet, prénom et photo', () => {
    expect(identiteDe({ user_metadata: { full_name: 'Aïcha Nkou', picture: 'https://lh3.googleusercontent.com/a/x' } })).toEqual({
      nom: 'Aïcha Nkou',
      prenom: 'Aïcha',
      photo: 'https://lh3.googleusercontent.com/a/x',
    });
  });

  it('prénom donné par le fournisseur, photo « avatar_url »', () => {
    expect(identiteDe({ user_metadata: { given_name: 'Kevin', family_name: 'Tchoua', avatar_url: 'https://x/y.jpg' } })).toEqual({ nom: 'Kevin Tchoua', prenom: 'Kevin', photo: 'https://x/y.jpg' });
  });

  it('compte sans nom (e-mail) : rien, pas d’invention', () => {
    expect(identiteDe({ user_metadata: {} })).toEqual({ nom: null, prenom: null, photo: null });
    expect(identiteDe(null)).toEqual({ nom: null, prenom: null, photo: null });
  });

  it('photo non https ignorée', () => {
    expect(identiteDe({ user_metadata: { name: 'A B', picture: 'file:///etc/passwd' } }).photo).toBeNull();
  });
});
