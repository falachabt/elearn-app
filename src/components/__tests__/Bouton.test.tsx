import { fireEvent, render, screen } from '@testing-library/react-native';

import { Bouton } from '../Bouton';

describe('Bouton', () => {
  it('affiche le libellé et appelle onPress', async () => {
    const onPress = jest.fn();
    await render(<Bouton libelle="Commencer" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Commencer' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('n’appelle pas onPress quand il est désactivé', async () => {
    const onPress = jest.fn();
    await render(<Bouton libelle="Commencer" onPress={onPress} desactive />);
    await fireEvent.press(screen.getByRole('button', { name: 'Commencer' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});
