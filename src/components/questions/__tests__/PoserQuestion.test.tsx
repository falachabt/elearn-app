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
  it('Publier reste désactivé sans matière ou sans texte valide', async () => {
    await render(ecran);
    const publier = () => screen.getByRole('button', { name: 'Publier' });
    expect(publier().props.accessibilityState?.disabled ?? publier().props['aria-disabled']).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Ta question'), 'Comment résoudre x² = 4 ?');
    expect(publier().props.accessibilityState?.disabled ?? publier().props['aria-disabled']).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Maths' }));
    expect(publier().props.accessibilityState?.disabled ?? publier().props['aria-disabled']).toBeFalsy();
  });

  it('affiche l’avertissement sur les numéros', async () => {
    await render(ecran);
    expect(screen.getByText(/Ne partage pas ton numéro/)).toBeTruthy();
  });
});
