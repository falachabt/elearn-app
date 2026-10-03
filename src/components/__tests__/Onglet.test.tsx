import { render, screen } from '@testing-library/react-native';

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
