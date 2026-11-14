import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { EnteteToeic } from '../ui';
import { monter } from './harnais';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) } }));

describe('en-tête TOEIC : titre long à 360 px (écart E-04)', () => {
  it('la ligne d’en-tête peut rétrécir et le titre passe sur deux lignes, sans dépasser la largeur', async () => {
    await monter(<EnteteToeic titre="Décrire une photo au présent continu" onRetour={() => {}} />);
    const titre = await screen.findByRole('header');
    expect(titre.props.numberOfLines).toBe(2);
    const ligne = StyleSheet.flatten(titre.parent!.props.style);
    // React Native web ne rétrécit pas une vue par défaut (flexShrink 0) : sans cela, la ligne gardait la largeur du texte sur une seule ligne.
    expect(ligne.flexShrink).toBe(1);
    expect(ligne.minWidth).toBe(0);
    expect(StyleSheet.flatten(titre.props.style).minWidth).toBe(0);
  });
});
