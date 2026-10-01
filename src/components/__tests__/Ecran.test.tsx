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

  it('dégage la barre d’état et la barre de navigation sur un cadre fixe, hors du défilement (edge-to-edge)', async () => {
    await render(avecTheme('clair', <Ecran><Text>a</Text></Ecran>));
    const cadre = StyleSheet.flatten(screen.getByTestId('ecran-cadre').props.style);
    expect(cadre.paddingTop).toBe(47);
    expect(cadre.paddingBottom).toBe(34);
    // Régression (30/09) : l'inset du haut était dans le contenu défilant, qui passait alors sous l'heure et la batterie.
    const contenu = StyleSheet.flatten(screen.getByTestId('ecran-defilement').props.contentContainerStyle);
    expect(contenu.paddingTop).toBeLessThan(47);
  });

  it('le défileur est à l’intérieur du cadre : rien ne défile sous la barre d’état', async () => {
    await render(avecTheme('clair', <Ecran><Text>a</Text></Ecran>));
    const cadre = screen.getByTestId('ecran-cadre');
    expect(cadre).toContainElement(screen.getByTestId('ecran-defilement'));
  });

  it('dans les onglets (insetBas faux), la barre d’onglets gère le bas', async () => {
    await render(avecTheme('clair', <Ecran insetBas={false}><Text>a</Text></Ecran>));
    expect(StyleSheet.flatten(screen.getByTestId('ecran-cadre').props.style).paddingBottom).toBe(0);
  });

  it('avec un pied, l’inset du bas passe sous le pied (pas deux fois)', async () => {
    await render(avecTheme('clair', <Ecran pied={<Text>pied</Text>}><Text>a</Text></Ecran>));
    expect(StyleSheet.flatten(screen.getByTestId('ecran-cadre').props.style).paddingBottom).toBe(0);
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

  it('en-tête fixe : hors du défilement, séparateur dès que le contenu défile', async () => {
    await render(avecTheme('clair', <Ecran entete={<Text>Titre</Text>}><Text>corps</Text></Ecran>));
    const entete = screen.getByTestId('ecran-entete');
    const defilement = screen.getByTestId('ecran-defilement');
    expect(screen.getByText('Titre')).toBeTruthy();
    expect(defilement).not.toContainElement(entete);
    expect(StyleSheet.flatten(entete.props.style).borderBottomColor).toBe('transparent');
    await fireEvent.scroll(defilement, { nativeEvent: { contentOffset: { y: 40 } } });
    expect(StyleSheet.flatten(screen.getByTestId('ecran-entete').props.style).borderBottomColor).toBe(themes.light.bord.fort);
  });

  it('retour en haut : apparaît après un long défilement et remonte', async () => {
    await render(avecTheme('clair', <Ecran><Text>long</Text></Ecran>));
    const defilement = screen.getByTestId('ecran-defilement');
    expect(screen.queryByRole('button', { name: 'Revenir en haut' })).toBeNull();
    await fireEvent.scroll(defilement, { nativeEvent: { contentOffset: { y: 300 } } });
    expect(screen.queryByRole('button', { name: 'Revenir en haut' })).toBeNull();
    await fireEvent.scroll(defilement, { nativeEvent: { contentOffset: { y: 3000 } } });
    const bouton = screen.getByRole('button', { name: 'Revenir en haut' });
    await fireEvent.press(bouton);
    await fireEvent.scroll(defilement, { nativeEvent: { contentOffset: { y: 0 } } });
    expect(screen.queryByRole('button', { name: 'Revenir en haut' })).toBeNull();
  });

  it('retour en haut désactivable', async () => {
    await render(avecTheme('clair', <Ecran retourHaut={false}><Text>long</Text></Ecran>));
    await fireEvent.scroll(screen.getByTestId('ecran-defilement'), { nativeEvent: { contentOffset: { y: 3000 } } });
    expect(screen.queryByRole('button', { name: 'Revenir en haut' })).toBeNull();
  });
});
