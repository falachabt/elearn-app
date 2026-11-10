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

  it('compte sans nom complet mais avec email : déduit un nom propre et initiale', () => {
    expect(identiteDe({ user_metadata: {}, email: 'falachabt@gmail.com' })).toEqual({
      nom: 'Falachabt',
      prenom: 'Falachabt',
      photo: null,
    });
    expect(identiteDe({ user_metadata: {}, email: 'benny.kamga@yahoo.fr' })).toEqual({
      nom: 'Benny Kamga',
      prenom: 'Benny',
      photo: null,
    });
  });

  it('Google / OAuth : extrait photo et nom depuis identities si user_metadata est vide', () => {
    expect(
      identiteDe({
        user_metadata: {},
        email: 'falachabt@gmail.com',
        identities: [
          {
            identity_data: {
              full_name: 'Benny Falachabt',
              avatar_url: 'https://lh3.googleusercontent.com/a/google-avatar',
            },
          },
        ],
      } as never)
    ).toEqual({
      nom: 'Benny Falachabt',
      prenom: 'Benny',
      photo: 'https://lh3.googleusercontent.com/a/google-avatar',
    });
  });

  it('Facebook : supporte le format picture objet { data: { url } }', () => {
    expect(
      identiteDe({
        user_metadata: {
          name: 'Jean Paul',
          picture: { data: { url: 'https://platform-lookaside.fbsbx.com/photo.jpg' } },
        },
      } as never)
    ).toEqual({
      nom: 'Jean Paul',
      prenom: 'Jean',
      photo: 'https://platform-lookaside.fbsbx.com/photo.jpg',
    });
  });

  it('Apple : pas de photo fournie par Apple, nom extrait et initiale', () => {
    expect(
      identiteDe({
        user_metadata: {
          full_name: 'Jean Dupont',
          email: 'jean.dupont@privaterelay.appleid.com',
        },
      })
    ).toEqual({
      nom: 'Jean Dupont',
      prenom: 'Jean',
      photo: null,
    });
  });

  it('photo non https/http ignoree', () => {
    expect(identiteDe({ user_metadata: { name: 'A B', picture: 'file:///etc/passwd' } }).photo).toBeNull();
  });
});
