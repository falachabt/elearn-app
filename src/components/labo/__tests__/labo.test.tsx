import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ChatInteractif } from '../ChatInteractif';
import { GrapheFonction } from '../GrapheFonction';
import { PenduleInteractif } from '../PenduleInteractif';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn(), push: jest.fn() },
  Redirect: () => null,
}));
jest.mock('@/components/arrivee/MiniTest', () => ({ BoutonFermer: () => null }));

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } };
const ecranChat = (
  <SafeAreaProvider initialMetrics={metriques}>
    <ChatInteractif />
  </SafeAreaProvider>
);

describe('PenduleInteractif', () => {
  it('affiche les valeurs calculées pour L = 1 m, g = 9,8 (défauts)', async () => {
    await render(<PenduleInteractif />);
    expect(screen.getByText('Pendule simple')).toBeTruthy();
    expect(screen.getByText('2,01 s')).toBeTruthy();
    expect(screen.getByText('0,50 Hz')).toBeTruthy();
    expect(screen.getByText('29,9')).toBeTruthy();
  });

  it('le curseur de longueur recalcule la période (+0,1 m → 2,11 s)', async () => {
    await render(<PenduleInteractif />);
    await fireEvent(screen.getByLabelText('Longueur L'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(screen.getByText('2,11 s')).toBeTruthy();
  });

  it('pause et reprise basculent le libellé du bouton', async () => {
    await render(<PenduleInteractif />);
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Reprendre' })).toBeTruthy();
  });
});

describe('GrapheFonction', () => {
  it('affiche l’expression et le sommet de 2x² + 3x + 4', async () => {
    await render(<GrapheFonction a={2} b={3} c={4} />);
    expect(screen.getByText('f(x) = 2x² + 3x + 4')).toBeTruthy();
    expect(screen.getByText(/Sommet S\(−0,75 ; 2,875\)/)).toBeTruthy();
  });
});

describe('ChatInteractif', () => {
  it('accueil, puis les deux suggestions insèrent leurs blocs interactifs dans le fil', async () => {
    await render(ecranChat);
    expect(screen.getByText(/Filme un exercice ou pose-moi une question/)).toBeTruthy();
    expect(screen.getByText('Nouvelle question')).toBeTruthy();
    expect(screen.getByText('Filme un exercice, je te donne la correction')).toBeTruthy();
    expect(screen.getByText('Pose-moi directement une question')).toBeTruthy();
    expect(screen.queryByText('Photo + question')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Montre-moi le pendule' }));
    expect(screen.getByText('Pendule simple')).toBeTruthy();
    expect(screen.getByText('Période T')).toBeTruthy();

    // Mettre la simulation en pause avant de continuer : sinon sa boucle d'animation ne laisse jamais la file
    // d'événements se vider et le test expire.
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Trace f(x) = 2x² + 3x + 4' }));
    expect(screen.getByText('f(x) = 2x² + 3x + 4')).toBeTruthy();
  });

  it('photo seule : le résultat reste la correction structurée du parcours actuel', async () => {
    await render(ecranChat);
    await fireEvent.press(screen.getByRole('button', { name: 'Filme un exercice, je te donne la correction' }));
    expect(screen.getByText('Photo envoyée')).toBeTruthy();
    expect(screen.getByText(/À retenir : la période ne dépend que de la longueur/)).toBeTruthy();
    expect(screen.queryByText('Pendule simple')).toBeNull();
  });

  it('mode mixte : la photo attachée depuis le composeur part avec la question écrite', async () => {
    await render(ecranChat);
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une photo' }));
    expect(screen.getByText('Photo jointe')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Écris ta question…'), 'Explique-moi ce mouvement');
    await fireEvent.press(screen.getByRole('button', { name: 'Envoyer' }));
    expect(screen.getByText('Photo envoyée')).toBeTruthy();
    expect(screen.getByText(/je reconnais un pendule simple/)).toBeTruthy();
    expect(screen.getByText('Pendule simple')).toBeTruthy();
    // La vignette a disparu du composeur après l'envoi.
    expect(screen.queryByText('Photo jointe')).toBeNull();
  });

  it('mode mixte sans texte : la question par défaut accompagne la photo', async () => {
    await render(ecranChat);
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une photo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Envoyer' }));
    expect(screen.getByText('Photo envoyée')).toBeTruthy();
    expect(screen.getByText('Explique-moi ce mouvement')).toBeTruthy();
    expect(screen.getByText('Pendule simple')).toBeTruthy();
  });

  it('la photo attachée peut être retirée avant envoi', async () => {
    await render(ecranChat);
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une photo' }));
    expect(screen.getByText('Photo jointe')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retirer la photo' }));
    expect(screen.queryByText('Photo jointe')).toBeNull();
  });

  it('un message libre reçoit la réponse de démonstration', async () => {
    await render(ecranChat);
    await fireEvent.changeText(screen.getByLabelText('Écris ta question…'), 'Explique-moi les fractions');
    await fireEvent.press(screen.getByRole('button', { name: 'Envoyer' }));
    expect(screen.getByText('Explique-moi les fractions')).toBeTruthy();
    expect(screen.getByText(/Mode démo/)).toBeTruthy();
  });
});
