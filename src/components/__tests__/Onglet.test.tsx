import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Onglet } from '../Onglet';

describe('Onglet, pastille', () => {
  it('affiche le nombre, « 9+ » au-delà, rien à 0', async () => {
    const { rerender } = await render(<Onglet libelle="Questions" icone="chatbubbles-outline" badge={4} />);
    expect(screen.getByText('4')).toBeTruthy();
    await rerender(<Onglet libelle="Questions" icone="chatbubbles-outline" badge={25} />);
    expect(screen.getByText('9+')).toBeTruthy();
    await rerender(<Onglet libelle="Questions" icone="chatbubbles-outline" badge={0} />);
    expect(screen.queryByTestId('onglet-badge')).toBeNull();
  });
});

describe('Onglet Tests (trophée)', () => {
  it('se rend comme les autres onglets : pas de pastille centrale, étiquette en gras seulement quand actif', async () => {
    const { rerender } = await render(<Onglet libelle="Tests" icone="ribbon" trophee />);
    const inactif = screen.getByText('Tests');
    expect(StyleSheet.flatten(inactif.props.style).fontFamily).not.toBe('SpaceGrotesk-Bold');
    await rerender(<Onglet libelle="Tests" icone="ribbon" trophee isFocused />);
    expect(StyleSheet.flatten(screen.getByText('Tests').props.style).fontFamily).toBe('SpaceGrotesk-Bold');
    // Même racine que les autres onglets : aucune marge négative (le bouton central débordait).
    const racine = screen.getByRole('tab');
    expect(JSON.stringify(StyleSheet.flatten(racine.props.style))).not.toContain('-22');
  });
});
