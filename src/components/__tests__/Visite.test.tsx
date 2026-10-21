import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/theme/ThemeProvider';

import { VisiteProvider, margesVisite, useVisite } from '../Visite';

const mockCible = jest.fn();

function Ecran({ avecCible = false }: { avecCible?: boolean }) {
  const ref = useRef<View>(null);
  const { demarrer } = useVisite();
  return (
    <View>
      <View ref={ref} collapsable={false}><Text>Cible</Text></View>
      <Text onPress={() => {
        // Jest n'a pas de mise en page : on simule la mesure de la cible.
        (ref.current as unknown as { measureInWindow: unknown }).measureInWindow = (cb: (...a: number[]) => void) => cb(10, 10, 100, 40);
        demarrer([{ id: 'a', cible: ref, titre: 'Bienvenue', description: 'Première étape', ...(avecCible ? { surCible: mockCible } : {}) }, { id: 'b', cible: ref, titre: 'Suite', description: 'Deuxième' }]);
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

  const monter = async (avecCible: boolean) => {
    await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 34, bottom: 0, left: 0, right: 0 } }}>
        <ThemeProvider reglage="clair">
          <VisiteProvider><Ecran avecCible={avecCible} /></VisiteProvider>
        </ThemeProvider>
      </SafeAreaProvider>,
    );
  };

  // Zone d'appui posée sur le halo : seule vue absolue de 100 x 40 à (10, 10), sans libellé ni rôle.
  const zoneHalo = () => {
    type Noeud = { props: { style?: unknown }; children: (Noeud | string)[] };
    const chercher = (n: Noeud): Noeud | null => {
      const st = StyleSheet.flatten(n.props.style as never) as { left?: number; top?: number; width?: number; height?: number } | undefined;
      if (st?.left === 10 && st?.top === 10 && st?.width === 100 && st?.height === 40) return n;
      for (const c of n.children) {
        if (typeof c === 'string') continue;
        const r = chercher(c);
        if (r) return r;
      }
      return null;
    };
    return chercher(screen.root as unknown as Noeud) as never;
  };

  it('« Suivant » passe à l’étape suivante', async () => {
    await monter(false);
    await act(async () => { fireEvent.press(screen.getByText('Lancer')); });
    await screen.findByText('Bienvenue');
    await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
    await act(async () => { fireEvent.press(screen.getByText('Suivant')); });
    expect(await screen.findByText('Suite')).toBeTruthy();
    await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
  });

  it('un appui sur l’élément mis en avant lance son action puis passe à l’étape suivante', async () => {
    mockCible.mockReset().mockResolvedValue(true);
    await monter(true);
    await act(async () => { fireEvent.press(screen.getByText('Lancer')); });
    await screen.findByText('Bienvenue');
    await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
    const zone = zoneHalo();
    expect(zone).toBeTruthy();
    await act(async () => { fireEvent.press(zone); });
    expect(mockCible).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Suite')).toBeTruthy();
    await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
  });

  it('une action qui échoue (photo non prise) reste sur l’étape', async () => {
    mockCible.mockReset().mockResolvedValue(false);
    await monter(true);
    await act(async () => { fireEvent.press(screen.getByText('Lancer')); });
    await screen.findByText('Bienvenue');
    await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
    const zone = zoneHalo();
    await act(async () => { fireEvent.press(zone); });
    expect(mockCible).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Suite')).toBeNull();
    await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
  });

  it('la bibliothèque n’ajoute pas la barre d’état à la mesure : le halo reste sur l’élément', () => {
    const m = margesVisite(34);
    expect(m.insets.top).toBe(0);
    expect(m.extraInsets.top).toBe(34);
  });
});
