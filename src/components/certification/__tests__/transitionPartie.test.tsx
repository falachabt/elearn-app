import { fireEvent, screen } from '@testing-library/react-native';

import { TransitionPartie } from '../TransitionPartie';
import { monter } from './harnais';

describe('TransitionPartie (demi-test et test complet)', () => {
  it('annonce la fin de la partie précédente et le début de la suivante', async () => {
    await monter(<TransitionPartie precedente={1} partie={2} questions={25} onCommencer={jest.fn()} />);
    expect(screen.getByText('Fin de la partie 1 · Partie 2 commence.')).toBeTruthy();
    expect(screen.getByText('25 questions dans cette partie.')).toBeTruthy();
  });

  it('le bouton « Commencer la partie 2 » lance la partie', async () => {
    const onCommencer = jest.fn();
    await monter(<TransitionPartie precedente={1} partie={2} questions={25} onCommencer={onCommencer} />);
    fireEvent.press(screen.getByText('Commencer la partie 2'));
    expect(onCommencer).toHaveBeenCalledTimes(1);
  });
});
