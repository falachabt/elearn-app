import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useRef } from 'react';
import { Text, View } from 'react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/theme/ThemeProvider';

import { VisiteProvider, margesVisite, useVisite } from '../Visite';

function Ecran() {
  const ref = useRef<View>(null);
  const { demarrer } = useVisite();
  return (
    <View>
      <View ref={ref} collapsable={false}><Text>Cible</Text></View>
      <Text onPress={() => {
        // Jest n'a pas de mise en page : on simule la mesure de la cible.
        (ref.current as unknown as { measureInWindow: unknown }).measureInWindow = (cb: (...a: number[]) => void) => cb(10, 10, 100, 40);
        demarrer([{ id: 'a', cible: ref, titre: 'Bienvenue', description: 'Première étape' }, { id: 'b', cible: ref, titre: 'Suite', description: 'Deuxième' }]);
      }}>Lancer</Text>
    </View>
  );
}

describe('Visite', () => {
  it('affiche le titre de l’étape avec les textes traduits', async () => {
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 34, bottom: 0, left: 0, right: 0 } }}>
        <ThemeProvider reglage="sombre">
          <VisiteProvider><Ecran /></VisiteProvider>
        </ThemeProvider>
      </SafeAreaProvider>,
    );
    await act(async () => { fireEvent.press(screen.getByText('Lancer')); });
    expect(await screen.findByText('Bienvenue')).toBeTruthy();
    expect(screen.getByText('Première étape')).toBeTruthy();
    // Pastille d'étape courte : elle ne fait pas déborder la rangée Retour / Suivant.
    expect(screen.getByText('1/2')).toBeTruthy();
    // La bibliothèque annonce l'étape après 100 ms : on attend pour ne pas déborder sur la fin du test.
    await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
  });

  it('la bibliothèque n’ajoute pas la barre d’état à la mesure : le halo reste sur l’élément', () => {
    const m = margesVisite(34);
    expect(m.insets.top).toBe(0);
    expect(m.extraInsets.top).toBe(34);
  });
});
