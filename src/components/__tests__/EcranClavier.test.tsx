import { act, render, screen } from '@testing-library/react-native';
import { Keyboard, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/theme/ThemeProvider';

import { Ecran } from '../Ecran';

// Clavier ouvert : pas de marge parasite entre le pied (bouton) et le clavier.
const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, bottom: 34, left: 0, right: 0 } };
const monter = () => render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair"><Ecran pied={<Text>Payer</Text>}><Text>contenu</Text></Ecran></ThemeProvider></SafeAreaProvider>);
const aplatir = (style: unknown) => Object.assign({}, ...(Array.isArray(style) ? style.flat(3) : [style]).filter(Boolean));

it('le pied perd son inset du bas et sa grande marge quand le clavier s’ouvre, et les retrouve à la fermeture', async () => {
  const gestionnaires: Record<string, () => void> = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((evt: string, cb: () => void) => {
    gestionnaires[evt] = cb;
    return { remove: jest.fn() };
  }) as never);
  await monter();
  const pied = () => aplatir(screen.getByTestId('ecran-pied').props.style).paddingBottom;
  const ferme = pied();
  expect(ferme).toBeGreaterThanOrEqual(34); // inset du bas + marge
  await act(async () => gestionnaires.keyboardDidShow?.() ?? gestionnaires.keyboardWillShow?.());
  expect(pied()).toBeLessThan(ferme);
  expect(pied()).toBeLessThanOrEqual(16);
  await act(async () => gestionnaires.keyboardDidHide?.() ?? gestionnaires.keyboardWillHide?.());
  expect(pied()).toBe(ferme);
});
