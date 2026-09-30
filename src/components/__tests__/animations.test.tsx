import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';

import { Apparition } from '../Apparition';
import { Appui } from '../Appui';
import { Rebond } from '../Rebond';
import { Secousse } from '../Secousse';


const reduire = (v: boolean) => jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(v);
const flush = () => act(async () => {});
const aplati = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style) ?? {};

describe.each([false, true])('composants d’animation (animations réduites : %s)', (reduit) => {
  beforeEach(() => reduire(reduit));
  afterEach(() => jest.restoreAllMocks());

  it('Appui : transmet onPress et le rôle', async () => {
    const onPress = jest.fn();
    await render(
      <Appui accessibilityRole="button" onPress={onPress} ombre={4} couleurOmbre="#000">
        <Text>Go</Text>
      </Appui>,
    );
    await flush();
    await fireEvent(screen.getByRole('button'), 'pressIn');
    await fireEvent.press(screen.getByRole('button'));
    await fireEvent(screen.getByRole('button'), 'pressOut');
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('appui-ombre')).toBeTruthy();
  });

  it('Apparition, Secousse, Rebond : affichent toujours leur contenu', async () => {
    await render(
      <>
        <Apparition delai={100}><Text>a</Text></Apparition>
        <Secousse declencheur={1}><Text>b</Text></Secousse>
        <Rebond declencheur={1}><Text>c</Text></Rebond>
      </>,
    );
    await flush();
    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
    expect(screen.getByText('c')).toBeTruthy();
  });
});

describe('réduction des animations', () => {
  afterEach(() => jest.restoreAllMocks());

  it('Appui : sans réduction, le corps porte une transformation animée', async () => {
    reduire(false);
    await render(<Appui><Text>x</Text></Appui>);
    await flush();
    expect(aplati('appui-corps').transform).toBeDefined();
  });

  it('Appui : avec réduction, aucune transformation', async () => {
    reduire(true);
    await render(<Appui><Text>x</Text></Appui>);
    await flush();
    expect(aplati('appui-corps').transform).toBeUndefined();
  });
});
