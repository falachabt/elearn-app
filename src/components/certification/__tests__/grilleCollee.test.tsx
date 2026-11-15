import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { themes } from '@/theme/theme';

import { EnteteCase, GrilleCollee, type CaseGrille } from '../ui';
import { monter } from './harnais';

const cases = (n: number, onPress = jest.fn()): CaseGrille[] =>
  Array.from({ length: n }, (_, i) => ({
    cle: `c${i}`,
    testID: `case-${i}`,
    accessibilityLabel: `Case ${i}`,
    onPress,
    contenu: <EnteteCase pastille={<Text>{`icone-${i}`}</Text>} etiquette={<Text>{`etat-${i}`}</Text>} />,
  }));

// La mesure se fait sur le contenu de la case (hauteur naturelle) : 2 x 16 px d'espace interne s'y ajoutent.
const mesurer = async (id: string, hauteur: number) => fireEvent(screen.getByTestId(`${id}-contenu`), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 150, height: hauteur - 32 } } });

describe('GrilleCollee (option B : cartes collées en un seul bloc)', () => {
  it('toutes les cases prennent la hauteur de la plus haute, dans toute la grille (pas ligne par ligne)', async () => {
    await monter(<GrilleCollee cases={cases(5)} />);
    await mesurer('case-0', 120);
    await mesurer('case-3', 188);
    await mesurer('case-4', 140);
    for (let i = 0; i < 5; i += 1) expect(StyleSheet.flatten(screen.getByTestId(`case-${i}`).props.style).minHeight).toBe(188);
  });

  it('un seul bloc : un seul contour, des séparateurs fins entre colonnes et entre lignes, plus d’espace interne', async () => {
    await monter(<GrilleCollee cases={cases(4)} />);
    const droite = StyleSheet.flatten(screen.getByTestId('case-1').props.style);
    const gauche = StyleSheet.flatten(screen.getByTestId('case-0').props.style);
    expect(droite.borderLeftWidth).toBeGreaterThan(0);
    expect(gauche.borderLeftWidth).toBeUndefined();
    expect(gauche.padding).toBeGreaterThanOrEqual(16);
    // Aucune carte n’a son propre contour : seul le groupe en porte un.
    expect(gauche.borderWidth).toBeUndefined();
  });

  it('la dernière rangée incomplète est complétée par une case vide et les cases se pressent', async () => {
    const onPress = jest.fn();
    await monter(<GrilleCollee cases={cases(3, onPress)} />);
    await fireEvent.press(screen.getByLabelText('Case 2'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('l’étiquette d’état est à l’opposé de l’icône (icône à gauche, étiquette à droite de l’en-tête)', async () => {
    await monter(<GrilleCollee cases={cases(2)} />);
    expect(screen.getByText('icone-0')).toBeTruthy();
    let noeud = screen.getByText('icone-0').parent;
    let style: { justifyContent?: string; alignItems?: string } = {};
    while (noeud && style.justifyContent !== 'space-between') {
      style = (StyleSheet.flatten(noeud.props.style) ?? {}) as typeof style;
      noeud = noeud.parent;
    }
    expect(style.justifyContent).toBe('space-between');
    expect(style.alignItems).toBe('flex-start');
  });

  it('thème sombre : fond de surface du thème', async () => {
    await monter(<GrilleCollee cases={cases(2)} />, 'sombre');
    expect(StyleSheet.flatten(screen.getByTestId('case-0').props.style).backgroundColor).toBe(themes.dark.fond.surface);
  });
});
