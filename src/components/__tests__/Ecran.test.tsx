import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/theme/ThemeProvider';
import { themes } from '@/theme/theme';

import { Champ } from '../Champ';
import { COMPORTEMENT_CLAVIER, Ecran } from '../Ecran';

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } };
const avecTheme = (reglage: 'clair' | 'sombre', noeud: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={metriques}>
    <ThemeProvider reglage={reglage}>{noeud}</ThemeProvider>
  </SafeAreaProvider>
);

describe('Ecran', () => {
  it('évite le clavier : KeyboardAvoidingView en padding + défilement qui garde les appuis', async () => {
    await render(avecTheme('clair', <Ecran><Text>contenu</Text></Ecran>));
    expect(COMPORTEMENT_CLAVIER).toBe('padding');
    expect(screen.getByTestId('ecran')).toBeTruthy();
    const defileur = screen.getByTestId('ecran-defilement');
    expect(defileur.props.keyboardShouldPersistTaps).toBe('handled');
    expect(defileur.props.automaticallyAdjustKeyboardInsets).toBe(true);
    expect(screen.getByText('contenu')).toBeTruthy();
  });

  it('dégage la barre d’état en haut et la barre de navigation système en bas (edge-to-edge)', async () => {
    await render(avecTheme('clair', <Ecran><Text>a</Text></Ecran>));
    const style = StyleSheet.flatten(screen.getByTestId('ecran-defilement').props.contentContainerStyle);
    expect(style.paddingTop).toBeGreaterThanOrEqual(47);
    expect(style.paddingBottom).toBeGreaterThanOrEqual(34);
  });

  it('dans les onglets (insetBas faux), la barre d’onglets gère le bas', async () => {
    await render(avecTheme('clair', <Ecran insetBas={false}><Text>a</Text></Ecran>));
    const style = StyleSheet.flatten(screen.getByTestId('ecran-defilement').props.contentContainerStyle);
    expect(style.paddingBottom).toBeLessThan(34);
  });

  it('prend le fond du thème clair et sombre', async () => {
    const { rerender } = await render(avecTheme('clair', <Ecran><Text>a</Text></Ecran>));
    const fond = () => screen.getByTestId('ecran').props.style.flat().find((s: object) => s && 'backgroundColor' in s).backgroundColor;
    expect(fond()).toBe(themes.light.fond.app);
    await rerender(avecTheme('sombre', <Ecran><Text>a</Text></Ecran>));
    expect(fond()).toBe(themes.dark.fond.app);
  });

  it('affiche le pied fixe hors du défilement', async () => {
    await render(avecTheme('clair', <Ecran pied={<Text>pied</Text>}><Text>corps</Text></Ecran>));
    expect(screen.getByTestId('ecran-defilement')).toBeTruthy();
    expect(screen.getByText('pied')).toBeTruthy();
  });

  it('un Champ dans Ecran reste utilisable : focus et onFocus de l’appelant préservé', async () => {
    const onFocus = jest.fn();
    await render(avecTheme('clair', <Ecran><Champ libelle="E-mail" onFocus={onFocus} /></Ecran>));
    await fireEvent(screen.getByLabelText('E-mail'), 'focus');
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('un Champ hors Ecran ne plante pas au focus', async () => {
    await render(avecTheme('clair', <Champ libelle="Code" />));
    await fireEvent(screen.getByLabelText('Code'), 'focus');
  });
});
