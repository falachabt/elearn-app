import { fireEvent, render, screen } from '@testing-library/react-native';

import { Composeur } from '../Composeur';

describe('Composeur', () => {
  it('envoi désactivé tant que le champ est vide, puis envoie et vide le champ', async () => {
    const onEnvoyer = jest.fn();
    await render(<Composeur repondA={null} onAnnulerCible={jest.fn()} onEnvoyer={onEnvoyer} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Envoyer' }));
    expect(onEnvoyer).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Ta réponse'), 'Isole x puis prends la racine');
    await fireEvent.press(screen.getByRole('button', { name: 'Envoyer' }));
    expect(onEnvoyer).toHaveBeenCalledWith('Isole x puis prends la racine', null);
    expect(screen.getByLabelText('Ta réponse').props.value).toBe('');
  });

  it('prévient quand un numéro est saisi', async () => {
    await render(<Composeur repondA={null} onAnnulerCible={jest.fn()} onEnvoyer={jest.fn()} />);
    expect(screen.queryByText('Numéro détecté : il sera masqué à l’envoi.')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Ta réponse'), 'appelle le 6 94 05 18 93');
    expect(screen.getByText('Numéro détecté : il sera masqué à l’envoi.')).toBeTruthy();
  });

  it('bandeau « Réponse à » avec retour à la question', async () => {
    const onAnnuler = jest.fn();
    await render(<Composeur repondA="Paul" onAnnulerCible={onAnnuler} onEnvoyer={jest.fn()} />);
    expect(screen.getByText('Réponse à Paul')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Répondre à la question' }));
    expect(onAnnuler).toHaveBeenCalled();
  });
});
