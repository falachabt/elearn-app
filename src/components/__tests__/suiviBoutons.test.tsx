import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { suivre } from '@/services/analytics';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { Appui } from '../Appui';
import { Bouton } from '../Bouton';
import { Interrupteur } from '../Interrupteur';

jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));

const rendre = (ui: React.ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

beforeEach(() => jest.clearAllMocks());

describe('suivi des boutons (button_pressed)', () => {
  it('un Bouton suit son libellé et garde son onPress', async () => {
    const onPress = jest.fn();
    await rendre(<Bouton libelle="Payer mon Pass" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Payer mon Pass' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(suivre).toHaveBeenCalledWith('button_pressed', { bouton: 'Payer mon Pass' });
  });

  it('un Bouton désactivé ne suit rien', async () => {
    await rendre(<Bouton libelle="Payer" onPress={jest.fn()} desactive />);
    await fireEvent.press(screen.getByRole('button', { name: 'Payer' }));
    expect(suivre).not.toHaveBeenCalled();
  });

  it('Appui ne suit que si un nom stable est donné : jamais le texte d’un contenu', async () => {
    const onPress = jest.fn();
    await rendre(
      <>
        <Appui accessibilityRole="button" accessibilityLabel="Quelle est la dérivée de x² ?" onPress={onPress}>
          <Text>question</Text>
        </Appui>
        <Appui accessibilityRole="button" accessibilityLabel="Fermer" suivi="fermer_feuille" onPress={onPress}>
          <Text>x</Text>
        </Appui>
      </>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Quelle est la dérivée de x² ?' }));
    expect(suivre).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Fermer' }));
    expect(suivre).toHaveBeenCalledWith('button_pressed', { bouton: 'fermer_feuille' });
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('tronque un nom trop long', async () => {
    await rendre(
      <Appui accessibilityRole="button" suivi={'a'.repeat(100)} onPress={jest.fn()}>
        <Text>x</Text>
      </Appui>,
    );
    await fireEvent.press(screen.getByRole('button'));
    expect(((suivre as jest.Mock).mock.calls[0][1] as { bouton: string }).bouton).toHaveLength(60);
  });

  it('un interrupteur suit son libellé et transmet le changement', async () => {
    const onChange = jest.fn();
    await rendre(<Interrupteur libelle="Sons" valeur={false} onChange={onChange} />);
    await fireEvent.press(screen.getByRole('switch', { name: 'Sons' }));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(suivre).toHaveBeenCalledWith('button_pressed', { bouton: 'interrupteur:Sons' });
  });
});
