import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useRef } from 'react';
import { Text, View } from 'react-native';

import { ThemeProvider } from '@/theme/ThemeProvider';

import { VisiteProvider, useVisite } from '../Visite';

function Ecran() {
  const ref = useRef<View>(null);
  const { demarrer } = useVisite();
  return (
    <View>
      <View ref={ref} collapsable={false}><Text>Cible</Text></View>
      <Text onPress={() => {
        // Jest n'a pas de mise en page : on simule la mesure de la cible.
        (ref.current as unknown as { measureInWindow: unknown }).measureInWindow = (cb: (...a: number[]) => void) => cb(10, 10, 100, 40);
        demarrer([{ id: 'a', cible: ref, titre: 'Bienvenue', description: 'Première étape' }]);
      }}>Lancer</Text>
    </View>
  );
}

describe('Visite', () => {
  it('affiche le titre de l’étape avec les textes traduits', async () => {
    await render(
      <ThemeProvider reglage="sombre">
        <VisiteProvider><Ecran /></VisiteProvider>
      </ThemeProvider>,
    );
    await act(async () => { fireEvent.press(screen.getByText('Lancer')); });
    expect(await screen.findByText('Bienvenue')).toBeTruthy();
    expect(screen.getByText('Première étape')).toBeTruthy();
    // La bibliothèque annonce l'étape après 100 ms : on attend pour ne pas déborder sur la fin du test.
    await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
  });
});
