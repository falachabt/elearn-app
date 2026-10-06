import { fireEvent, render, screen } from '@testing-library/react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PoserQuestion } from '../PoserQuestion';

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } };
const ecran = (
  <SafeAreaProvider initialMetrics={metriques}>
    <PoserQuestion />
  </SafeAreaProvider>
);

describe('PoserQuestion', () => {
  it('Publier reste actif : un appui incomplet montre ce qu’il manque au lieu de rester muet', async () => {
    await render(ecran);
    const publier = () => screen.getByRole('button', { name: 'Publier' });
    expect(publier().props.accessibilityState?.disabled ?? publier().props['aria-disabled']).toBeFalsy();
    // Le minimum de caractères est affiché d'emblée.
    expect(screen.getByText('Au moins 10 caractères, ou une photo.')).toBeTruthy();
    await fireEvent.press(publier());
    expect(screen.getByText('Écris au moins 10 caractères, ou ajoute une photo.')).toBeTruthy();
    expect(screen.getByText('Choisis une matière.')).toBeTruthy();
    // Texte trop court : l'erreur reste sur le texte, la matière aussi.
    await fireEvent.changeText(screen.getByLabelText('Ta question'), 'Comment ?');
    await fireEvent.press(publier());
    expect(screen.getByText('Écris au moins 10 caractères, ou ajoute une photo.')).toBeTruthy();
    // Texte valide et matière choisie : les erreurs disparaissent.
    await fireEvent.changeText(screen.getByLabelText('Ta question'), 'Comment résoudre x² = 4 ?');
    await fireEvent.press(screen.getByRole('button', { name: 'Maths' }));
    expect(screen.queryByText('Écris au moins 10 caractères, ou ajoute une photo.')).toBeNull();
    expect(screen.queryByText('Choisis une matière.')).toBeNull();
  });

  it('affiche l’avertissement sur les numéros', async () => {
    await render(ecran);
    expect(screen.getByText(/Ne partage pas ton numéro/)).toBeTruthy();
  });
});
