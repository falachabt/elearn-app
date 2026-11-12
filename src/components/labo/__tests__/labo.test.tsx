import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { demanderConversation } from '@/services/conversation';

import { ChatInteractif } from '../ChatInteractif';
import { GrapheFonction } from '../GrapheFonction';
import { PenduleInteractif } from '../PenduleInteractif';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn(), push: jest.fn() },
  Redirect: () => null,
}));
jest.mock('@/components/arrivee/MiniTest', () => ({ BoutonFermer: () => null }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({}) }));
jest.mock('@/services/conversation', () => ({ demanderConversation: jest.fn() }));

const moteur = demanderConversation as jest.Mock;

/** Réponses du moteur simulées pour les tests d'écran : mêmes formes que la fonction « conversation ». */
function moteurNominal() {
  moteur.mockImplementation(async (_client: unknown, opts: { question?: string | null; image?: string | null }) => {
    if (opts.image) {
      return {
        type: 'fin',
        repli: false,
        blocs: [
          { type: 'texte', texte: "D'après ta photo, je reconnais un pendule simple." },
          { type: 'pendule', longueur: 0.8, amplitudeDeg: 35, pesanteur: 9.8 },
          { type: 'texte', texte: 'À retenir : la période de ton montage vaut environ 1,80 s.' },
        ],
      };
    }
    if ((opts.question ?? '').includes('pendule')) {
      return {
        type: 'fin',
        repli: false,
        blocs: [
          { type: 'texte', texte: 'Voici le pendule simple.' },
          { type: 'pendule', longueur: 1, amplitudeDeg: 30, pesanteur: 9.8 },
          { type: 'texte', texte: 'À retenir : plus le fil est long, plus la période augmente.' },
        ],
      };
    }
    if ((opts.question ?? '').includes('Trace')) {
      return {
        type: 'fin',
        repli: false,
        blocs: [
          { type: 'texte', texte: 'Voici la courbe demandée.' },
          { type: 'fonction', a: 2, b: 3, c: 4 },
          { type: 'texte', texte: 'Le sommet est le minimum de la parabole.' },
        ],
      };
    }
    return { type: 'fin', repli: false, blocs: [{ type: 'texte', texte: 'Réponse du moteur à ta question.' }] };
  });
}

beforeEach(() => {
  moteurNominal();
});

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

  it('les paramètres reçus deviennent les valeurs de départ (photo : L = 0,8 m, 35° → 1,80 s)', async () => {
    await render(<PenduleInteractif longueur={0.8} amplitudeDeg={35} pesanteur={9.8} />);
    expect(screen.getByText('1,80 s')).toBeTruthy();
    expect(screen.getByText('0,8 m')).toBeTruthy();
    expect(screen.getByText('35 °')).toBeTruthy();
  });

  it('les paramètres hors bornes sont plafonnés (L = 12 m → 3 m, g = 0,5 → 1,6, soit 8,60 s)', async () => {
    await render(<PenduleInteractif longueur={12} amplitudeDeg={120} pesanteur={0.5} />);
    expect(screen.getByText('8,60 s')).toBeTruthy();
    expect(screen.getByText('3,0 m')).toBeTruthy();
    expect(screen.getByText('60 °')).toBeTruthy();
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
  it('accueil, puis les deux suggestions affichent les blocs du moteur dans le fil', async () => {
    await render(ecranChat);
    expect(screen.getByText(/Filme un exercice ou pose-moi une question/)).toBeTruthy();
    expect(screen.getByText('Nouvelle question')).toBeTruthy();
    expect(screen.getByText('Filme un exercice, je te donne la correction')).toBeTruthy();
    expect(screen.getByText('Pose-moi directement une question')).toBeTruthy();
    expect(screen.queryByText('Photo + question')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Montre-moi le pendule' }));
    expect(await screen.findByText('Pendule simple')).toBeTruthy();
    expect(screen.getByText('Période T')).toBeTruthy();
    expect(screen.getByText('2,01 s')).toBeTruthy();

    // Mettre la simulation en pause avant de continuer : sinon sa boucle d'animation ne laisse jamais la file
    // d'événements se vider et le test expire.
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Trace f(x) = 2x² + 3x + 4' }));
    expect(await screen.findByText('f(x) = 2x² + 3x + 4')).toBeTruthy();
  });

  it('photo seule : le résultat reste la correction structurée du parcours actuel', async () => {
    await render(ecranChat);
    await fireEvent.press(screen.getByRole('button', { name: 'Filme un exercice, je te donne la correction' }));
    expect(screen.getByText('Photo envoyée')).toBeTruthy();
    expect(screen.getByText(/À retenir : la période ne dépend que de la longueur/)).toBeTruthy();
    expect(screen.queryByText('Pendule simple')).toBeNull();
  });

  it('mode mixte : la photo attachée depuis le composeur part au moteur avec la question écrite', async () => {
    await render(ecranChat);
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une photo' }));
    expect(screen.getByText('Photo jointe')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Écris ta question…'), 'Explique-moi ce mouvement');
    await fireEvent.press(screen.getByRole('button', { name: 'Envoyer' }));
    expect(screen.getByText('Photo envoyée')).toBeTruthy();
    expect(await screen.findByText(/je reconnais un pendule simple/)).toBeTruthy();
    expect(screen.getByText('Pendule simple')).toBeTruthy();
    // Le moteur a lu la photo : la simulation démarre sur les paramètres du montage (L = 0,8 m → 1,80 s).
    expect(screen.getByText('1,80 s')).toBeTruthy();
    // La vignette a disparu du composeur après l'envoi.
    expect(screen.queryByText('Photo jointe')).toBeNull();
    // L'appel est bien parti en mode mixte (question + image).
    const appelMixte = moteur.mock.calls.some((c) => typeof c[1]?.image === 'string' && c[1].image.length > 1000);
    expect(appelMixte).toBe(true);
  });

  it('mode mixte sans texte : la question par défaut accompagne la photo', async () => {
    await render(ecranChat);
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une photo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Envoyer' }));
    expect(screen.getByText('Photo envoyée')).toBeTruthy();
    expect(screen.getByText('Explique-moi ce mouvement')).toBeTruthy();
    expect(await screen.findByText('Pendule simple')).toBeTruthy();
  });

  it('la photo attachée peut être retirée avant envoi', async () => {
    await render(ecranChat);
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une photo' }));
    expect(screen.getByText('Photo jointe')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retirer la photo' }));
    expect(screen.queryByText('Photo jointe')).toBeNull();
  });

  it('un message libre reçoit la réponse du moteur', async () => {
    await render(ecranChat);
    await fireEvent.changeText(screen.getByLabelText('Écris ta question…'), 'Explique-moi les fractions');
    await fireEvent.press(screen.getByRole('button', { name: 'Envoyer' }));
    expect(screen.getByText('Explique-moi les fractions')).toBeTruthy();
    expect(await screen.findByText('Réponse du moteur à ta question.')).toBeTruthy();
    expect(screen.queryByText(/Moteur injoignable/)).toBeNull();
  });

  it('moteur injoignable : la démo prend le relais, présentée comme un repli', async () => {
    moteur.mockResolvedValue({ type: 'hors-ligne' });
    await render(ecranChat);
    await fireEvent.changeText(screen.getByLabelText('Écris ta question…'), 'Explique-moi les fractions');
    await fireEvent.press(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText(/Moteur injoignable — réponse de démonstration/)).toBeTruthy();
    expect(screen.getByText(/Je n'ai pas de réponse préparée pour cette question/)).toBeTruthy();
  });

  it('limite de cadence atteinte : message dédié, pas de démo', async () => {
    moteur.mockResolvedValue({ type: 'limite', minutes: 2 });
    await render(ecranChat);
    await fireEvent.press(screen.getByRole('button', { name: 'Montre-moi le pendule' }));
    expect(await screen.findByText(/Trop de questions pour le moment/)).toBeTruthy();
    expect(screen.queryByText('Pendule simple')).toBeNull();
  });
});
