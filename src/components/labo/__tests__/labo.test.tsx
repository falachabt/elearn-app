import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { demanderConversation } from '@/services/conversation';
import { choisirPhotoLabo, preparerPhotoLabo } from '@/services/laboPhoto';

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
jest.mock('@/services/laboPhoto', () => ({ choisirPhotoLabo: jest.fn(), preparerPhotoLabo: jest.fn(), NB_MAX_PHOTOS: 4 }));

const mockDemarrerVisite = jest.fn();
jest.mock('@/components/Visite', () => ({ useVisite: () => ({ demarrer: mockDemarrerVisite }) }));

const moteur = demanderConversation as jest.Mock;
const selecteur = choisirPhotoLabo as jest.Mock;
const preparation = preparerPhotoLabo as jest.Mock;

/** Photo préparée par le recadrage simulé : une vraie uri locale et ses octets JPEG. */
const PHOTO_TEST = { uri: 'file:///photo-eleve.jpg', base64: 'BASE64_PHOTO_TEST' };

function selecteurNominal() {
  selecteur.mockResolvedValue({ type: 'photo', photo: { uri: 'file:///brute.jpg', largeur: 1200, hauteur: 900 } });
  preparation.mockResolvedValue(PHOTO_TEST);
}

/** Après le sélecteur, l'étape de recadrage s'affiche : on la valide pour obtenir la photo préparée. */
async function validerRecadrage() {
  await fireEvent.press(await screen.findByRole('button', { name: 'Utiliser la photo' }));
}

/** Réponses du moteur simulées pour les tests d'écran : mêmes formes que la fonction « conversation ». */
function moteurNominal() {
  moteur.mockImplementation(async (_client: unknown, opts: { question?: string | null; images?: string[] | null }) => {
    if (opts.images?.length) {
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
          { type: 'texte', texte: 'À retenir : la période vaut $T = 2\\pi\\sqrt{\\dfrac{L}{g}}$ — plus le fil est long, plus elle augmente.' },
        ],
      };
    }
    if ((opts.question ?? '').includes('formule seule')) {
      return { type: 'fin', repli: false, blocs: [{ type: 'texte', texte: '$E = mc^2$' }] };
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
  selecteurNominal();
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

  it('photo seule : l’entrée ouvre le vrai sélecteur, la photo choisie part au moteur', async () => {
    moteur.mockClear();
    await render(ecranChat);
    await fireEvent.press(screen.getByRole('button', { name: 'Filme un exercice, je te donne la correction' }));
    // Le choix caméra / galerie s'ouvre (avant : l'entrée postait directement une photo simulée).
    expect(await screen.findByRole('button', { name: 'Prendre une photo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choisir dans la galerie' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Prendre une photo' }));
    expect(selecteur).toHaveBeenCalledWith('camera');
    // Le recadrage s'affiche avant tout envoi : on le valide, la photo préparée part au moteur.
    await validerRecadrage();
    // La vraie photo de l'élève est dans le fil, et le moteur répond sur ce qu'il y voit.
    expect(await screen.findByText('Photo envoyée')).toBeTruthy();
    expect(await screen.findByText(/je reconnais un pendule simple/)).toBeTruthy();
    expect(screen.getByText('Pendule simple')).toBeTruthy();
    // L'appel est parti avec les octets de la photo recadrée, sans question écrite.
    const appel = moteur.mock.calls.find((c) => c[1]?.images?.[0] === PHOTO_TEST.base64);
    expect(appel).toBeTruthy();
    expect(appel[1].question ?? null).toBeNull();
  });

  it('photo seule, moteur injoignable : la correction de démonstration prend le relais, présentée comme un repli', async () => {
    moteur.mockResolvedValue({ type: 'hors-ligne' });
    await render(ecranChat);
    await fireEvent.press(screen.getByRole('button', { name: 'Filme un exercice, je te donne la correction' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Choisir dans la galerie' }));
    expect(selecteur).toHaveBeenCalledWith('bibliotheque');
    await validerRecadrage();
    expect(await screen.findByText(/Moteur injoignable — réponse de démonstration/)).toBeTruthy();
    // La démo est une correction structurée : mêmes rubriques que la correction par photo.
    expect(screen.getByText('Méthode')).toBeTruthy();
    expect(screen.getByText('À retenir')).toBeTruthy();
    expect(screen.getByText(/La période ne dépend que de la longueur du fil/)).toBeTruthy();
  });

  it('sélecteur annulé : rien n’est attaché, rien n’est envoyé, pas de recadrage', async () => {
    selecteur.mockResolvedValue({ type: 'annule' });
    moteur.mockClear();
    await render(ecranChat);
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une photo' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Prendre une photo' }));
    expect(screen.queryByRole('button', { name: 'Utiliser la photo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retirer la photo' })).toBeNull();
    expect(screen.queryByText('Photo envoyée')).toBeNull();
    expect(moteur).not.toHaveBeenCalled();
  });

  it('permission refusée : la feuille d’explication s’affiche, rien n’est attaché', async () => {
    selecteur.mockResolvedValue({ type: 'permission' });
    await render(ecranChat);
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une photo' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Choisir dans la galerie' }));
    expect(await screen.findByText('Photo inaccessible')).toBeTruthy();
    expect(screen.getByText(/Autorise-le dans les réglages/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retirer la photo' })).toBeNull();
  });

  it('mode mixte : la photo attachée depuis le composeur part au moteur avec la question écrite', async () => {
    await render(ecranChat);
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une photo' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Choisir dans la galerie' }));
    await validerRecadrage();
    expect(await screen.findByRole('button', { name: 'Retirer la photo' })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Écris ta question…'), 'Explique-moi ce mouvement');
    await fireEvent.press(screen.getByRole('button', { name: 'Envoyer' }));
    expect(screen.getByText('Photo envoyée')).toBeTruthy();
    expect(await screen.findByText(/je reconnais un pendule simple/)).toBeTruthy();
    expect(screen.getByText('Pendule simple')).toBeTruthy();
    // Le moteur a lu la photo : la simulation démarre sur les paramètres du montage (L = 0,8 m → 1,80 s).
    expect(screen.getByText('1,80 s')).toBeTruthy();
    // La vignette a disparu du composeur après l'envoi.
    expect(screen.queryByRole('button', { name: 'Retirer la photo' })).toBeNull();
    // L'appel est bien parti en mode mixte (question + octets de la photo recadrée).
    const appelMixte = moteur.mock.calls.some((c) => c[1]?.images?.[0] === PHOTO_TEST.base64 && c[1]?.question === 'Explique-moi ce mouvement');
    expect(appelMixte).toBe(true);
  });

  it('mode mixte sans texte : la photo part seule au moteur, sans question inventée', async () => {
    moteur.mockClear();
    await render(ecranChat);
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une photo' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Prendre une photo' }));
    await validerRecadrage();
    expect(await screen.findByRole('button', { name: 'Retirer la photo' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Envoyer' }));
    expect(screen.getByText('Photo envoyée')).toBeTruthy();
    expect(screen.queryByText('Explique-moi ce mouvement')).toBeNull();
    expect(await screen.findByText('Pendule simple')).toBeTruthy();
    const appel = moteur.mock.calls.find((c) => c[1]?.images?.[0] === PHOTO_TEST.base64);
    expect(appel[1].question ?? null).toBeNull();
  });

  it('la photo attachée peut être retirée avant envoi', async () => {
    await render(ecranChat);
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une photo' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Choisir dans la galerie' }));
    await validerRecadrage();
    expect(await screen.findByRole('button', { name: 'Retirer la photo' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Retirer la photo' }));
    expect(screen.queryByRole('button', { name: 'Retirer la photo' })).toBeNull();
  });

  it('mode mixte multi-photos : deux photos attachées partent ensemble au moteur', async () => {
    moteur.mockClear();
    await render(ecranChat);
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une photo' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Choisir dans la galerie' }));
    await validerRecadrage();
    expect(await screen.findAllByRole('button', { name: 'Retirer la photo' })).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une photo' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Choisir dans la galerie' }));
    await validerRecadrage();
    expect(await screen.findAllByRole('button', { name: 'Retirer la photo' })).toHaveLength(2);
    await fireEvent.changeText(screen.getByLabelText('Écris ta question…'), 'Explique-moi ce mouvement');
    await fireEvent.press(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText(/je reconnais un pendule simple/)).toBeTruthy();
    const appel = moteur.mock.calls.find((c) => (c[1]?.images?.length ?? 0) === 2);
    expect(appel).toBeTruthy();
    expect(appel[1].images).toEqual([PHOTO_TEST.base64, PHOTO_TEST.base64]);
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
  });

  it('mode mixte multi-photos : une photo retirée ne part pas', async () => {
    moteur.mockClear();
    await render(ecranChat);
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une photo' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Choisir dans la galerie' }));
    await validerRecadrage();
    await fireEvent.press(screen.getByRole('button', { name: 'Ajouter une photo' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Choisir dans la galerie' }));
    await validerRecadrage();
    expect(await screen.findAllByRole('button', { name: 'Retirer la photo' })).toHaveLength(2);
    await fireEvent.press(screen.getAllByRole('button', { name: 'Retirer la photo' })[0]);
    expect(screen.getAllByRole('button', { name: 'Retirer la photo' })).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText(/je reconnais un pendule simple/)).toBeTruthy();
    const appels = moteur.mock.calls.filter((c) => (c[1]?.images?.length ?? 0) > 0);
    expect(appels).toHaveLength(1);
    expect(appels[0][1].images).toEqual([PHOTO_TEST.base64]);
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
  });

  it('le panneau « Nouvelle question » disparaît dès le premier envoi', async () => {
    await render(ecranChat);
    expect(screen.getByText('Nouvelle question')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Écris ta question…'), 'Explique-moi les fractions');
    await fireEvent.press(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText('Réponse du moteur à ta question.')).toBeTruthy();
    expect(screen.queryByText('Nouvelle question')).toBeNull();
    expect(screen.queryByText('Filme un exercice, je te donne la correction')).toBeNull();
    expect(screen.queryByText('Pose-moi directement une question')).toBeNull();
  });

  it('étapes de chargement (question écrite) : elles défilent pendant l’attente et disparaissent à la réponse', async () => {
    let resoudre: (v: unknown) => void = () => {};
    moteur.mockImplementation((_c: unknown, opts: { surEtape?: (e: string) => void }) => {
      opts.surEtape?.('redaction');
      return new Promise((r) => {
        resoudre = r as (v: unknown) => void;
      });
    });
    await render(ecranChat);
    await fireEvent.press(screen.getByRole('button', { name: 'Montre-moi le pendule' }));
    expect(await screen.findByText('Réflexion')).toBeTruthy();
    expect(screen.getByText('Rédaction de l’explication')).toBeTruthy();
    resoudre({
      type: 'fin',
      repli: false,
      blocs: [
        { type: 'texte', texte: 'Voici le pendule simple.' },
        { type: 'pendule', longueur: 1, amplitudeDeg: 30, pesanteur: 9.8 },
      ],
    });
    expect(await screen.findByText('Pendule simple')).toBeTruthy();
    expect(screen.queryByText('Réflexion')).toBeNull();
    expect(screen.queryByText('Rédaction de l’explication')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
  });

  it('étapes de chargement (photo) puis correction structurée aux rubriques de la correction photo', async () => {
    let resoudre: (v: unknown) => void = () => {};
    moteur.mockImplementation((_c: unknown, opts: { surEtape?: (e: string) => void }) => {
      opts.surEtape?.('lecture');
      opts.surEtape?.('analyse');
      return new Promise((r) => {
        resoudre = r as (v: unknown) => void;
      });
    });
    await render(ecranChat);
    await fireEvent.press(screen.getByRole('button', { name: 'Filme un exercice, je te donne la correction' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Prendre une photo' }));
    await validerRecadrage();
    expect(await screen.findByText('Envoi de la photo')).toBeTruthy();
    expect(screen.getByText('Lecture de la photo')).toBeTruthy();
    expect(screen.getByText('Analyse')).toBeTruthy();
    expect(screen.getByText('Rédaction des étapes')).toBeTruthy();
    resoudre({
      type: 'fin',
      repli: false,
      blocs: [
        {
          type: 'correction',
          enonce: 'Un pendule simple de longueur 1 m est lâché. Calculer sa période.',
          methode: 'On applique la formule de la période du pendule simple.',
          etapes: [{ titre: 'Calcul', detail: 'T ≈ 2,01 s.' }],
          resultat: 'T ≈ 2,01 s',
          aRetenir: 'La période dépend de la longueur du fil.',
        },
      ],
    });
    expect(await screen.findByText('Méthode')).toBeTruthy();
    expect(screen.getByText('Résultat')).toBeTruthy();
    expect(screen.getByText('À retenir')).toBeTruthy();
    expect(screen.getByText(/La période dépend de la longueur du fil/)).toBeTruthy();
    expect(screen.queryByText('Envoi de la photo')).toBeNull();
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

  it('texte et formule mélangés : la formule est dessinée, aucun LaTeX brut affiché', async () => {
    await render(ecranChat);
    await fireEvent.press(screen.getByRole('button', { name: 'Montre-moi le pendule' }));
    expect(await screen.findByText('Pendule simple')).toBeTruthy();
    // La formule complexe de la réponse ($T = 2\pi\sqrt{\dfrac{L}{g}}$) est dessinée comme dans les corrections photo.
    expect(screen.getAllByTestId('formule-morceau').length).toBeGreaterThan(0);
    // Le texte autour reste affiché, et aucun « $ » ni LaTeX brut ne subsiste dans le fil.
    expect(screen.queryAllByText(/augmente/)).not.toHaveLength(0);
    expect(screen.queryAllByText(/\$/)).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
  });

  it('formule seule : convertie en texte lisible, aucun « $ » affiché', async () => {
    await render(ecranChat);
    await fireEvent.changeText(screen.getByLabelText('Écris ta question…'), 'Donne-moi la formule seule');
    await fireEvent.press(screen.getByRole('button', { name: 'Envoyer' }));
    expect((await screen.findAllByText(/E = mc²/)).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/\$/)).toHaveLength(0);
    // Formule simple : elle reste en texte dans la ligne, pas de dessin.
    expect(screen.queryAllByTestId('formule-morceau')).toHaveLength(0);
  });

  it('texte sans formule : affiché tel quel, sans dessin ni « $ »', async () => {
    await render(ecranChat);
    await fireEvent.changeText(screen.getByLabelText('Écris ta question…'), 'Explique-moi les fractions');
    await fireEvent.press(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText('Réponse du moteur à ta question.')).toBeTruthy();
    expect(screen.queryAllByTestId('formule-morceau')).toHaveLength(0);
    expect(screen.queryAllByText(/\$/)).toHaveLength(0);
  });

  it('bulle élève : une formule écrite par l’élève est rendue, pas affichée en LaTeX brut', async () => {
    await render(ecranChat);
    await fireEvent.changeText(screen.getByLabelText('Écris ta question…'), 'Calcule $x^2$ pour x = 3');
    await fireEvent.press(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByText('Réponse du moteur à ta question.')).toBeTruthy();
    expect(screen.queryAllByText(/x²/)).not.toHaveLength(0);
    expect(screen.queryAllByText(/\$/)).toHaveLength(0);
  });

  it('limite de cadence atteinte : message dédié, pas de démo', async () => {
    moteur.mockResolvedValue({ type: 'limite', minutes: 2 });
    await render(ecranChat);
    await fireEvent.press(screen.getByRole('button', { name: 'Montre-moi le pendule' }));
    expect(await screen.findByText(/Trop de questions pour le moment/)).toBeTruthy();
    expect(screen.queryByText('Pendule simple')).toBeNull();
  });
});

describe('ChatInteractif — visite guidée de première ouverture', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockDemarrerVisite.mockClear();
  });

  it('première ouverture : la visite démarre avec les 5 étapes (photo, question, mixte, pendule, fonction)', async () => {
    await render(ecranChat);
    await waitFor(() => expect(mockDemarrerVisite).toHaveBeenCalled(), { timeout: 5000 });
    const [etapes] = mockDemarrerVisite.mock.calls[0];
    expect(etapes.map((e: { id: string }) => e.id)).toEqual(['photo', 'question', 'mixte', 'pendule', 'fonction']);
    expect(etapes[0].titre).toBe('Filme un exercice');
    expect(etapes[2].titre).toBe('Photo + question');
    expect(etapes[3].titre).toBe('Un exemple : le pendule');
    expect(etapes[4].titre).toBe('Un autre exemple : une fonction');
  });

  it('visite menée au bout : le pendule est démontré pour de vrai, la fonction est pré-remplie sans être envoyée', async () => {
    moteur.mockClear();
    await render(ecranChat);
    await waitFor(() => expect(mockDemarrerVisite).toHaveBeenCalled(), { timeout: 5000 });
    const [, onFin] = mockDemarrerVisite.mock.calls[0];
    onFin(true);
    // Démonstration : la vraie suggestion pendule part au moteur et la simulation s'affiche dans le fil.
    expect(await screen.findByText('Pendule simple')).toBeTruthy();
    expect(moteur.mock.calls.some((c) => (c[1]?.question ?? '').includes('pendule'))).toBe(true);
    // Passage de main : l'exemple de la fonction attend dans le champ, sans avoir été envoyé au moteur.
    expect(screen.getByDisplayValue('Trace f(x) = 2x² + 3x + 4')).toBeTruthy();
    expect(moteur.mock.calls.some((c) => (c[1]?.question ?? '').includes('Trace'))).toBe(false);
    await waitFor(async () => expect(await AsyncStorage.getItem('labo.chat.visite.vue')).toBe('1'));
    await fireEvent.press(screen.getByRole('button', { name: 'Pause' }));
  });

  it('visite passée : marquée vue, mais aucun exemple lancé ni pré-rempli', async () => {
    moteur.mockClear();
    await render(ecranChat);
    await waitFor(() => expect(mockDemarrerVisite).toHaveBeenCalled(), { timeout: 5000 });
    const [, onFin] = mockDemarrerVisite.mock.calls[0];
    onFin(false);
    await waitFor(async () => expect(await AsyncStorage.getItem('labo.chat.visite.vue')).toBe('1'));
    expect(screen.queryByText('Pendule simple')).toBeNull();
    expect(screen.queryByDisplayValue('Trace f(x) = 2x² + 3x + 4')).toBeNull();
    expect(moteur).not.toHaveBeenCalled();
  });

  it('déjà vue : la visite ne redémarre pas', async () => {
    await AsyncStorage.setItem('labo.chat.visite.vue', '1');
    await render(ecranChat);
    await new Promise((r) => setTimeout(r, 1300));
    expect(mockDemarrerVisite).not.toHaveBeenCalled();
  });
});
