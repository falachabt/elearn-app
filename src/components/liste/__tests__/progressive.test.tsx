import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Progressive } from '../Progressive';

const ITEMS = Array.from({ length: 25 }, (_, i) => `Carte ${i + 1}`);

describe('Progressive', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('montre les premiers éléments tout de suite, puis le reste par paquets', async () => {
    const rendus = jest.fn((s: string) => <Text key={s}>{s}</Text>);
    await render(<Progressive items={ITEMS} initial={10} pas={10} rendu={rendus} />);
    expect(screen.getByText('Carte 10')).toBeTruthy();
    expect(screen.queryByText('Carte 11')).toBeNull();
    await act(() => jest.advanceTimersByTimeAsync(20));
    expect(screen.getByText('Carte 20')).toBeTruthy();
    expect(screen.queryByText('Carte 21')).toBeNull();
    await act(() => jest.advanceTimersByTimeAsync(20));
    expect(screen.getByText('Carte 25')).toBeTruthy();
    // Chaque carte n'est dessinée qu'une fois, pas à chaque paquet.
    expect(rendus).toHaveBeenCalledTimes(25);
  });

  it('une liste courte est montrée en entier au premier rendu', async () => {
    await render(<Progressive items={ITEMS.slice(0, 3)} initial={10} rendu={(s) => <Text key={s}>{s}</Text>} />);
    expect(screen.getByText('Carte 3')).toBeTruthy();
  });
});
