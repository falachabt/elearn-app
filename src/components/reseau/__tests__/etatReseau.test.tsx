import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { definirConnectivitePourTest, definirDernierContactPourTest, simulerJoursEcoules, type EtatConnectivite } from '@/services/connectivite';

import { EtatReseau } from '../EtatReseau';

// Mesures explicites : `Feuille` lit les marges de sécurité, et Jest n'a pas de vraie fenêtre.
const MESURES = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

function rendre() {
  return render(
    <SafeAreaProvider initialMetrics={MESURES}>
      <EtatReseau />
    </SafeAreaProvider>,
  );
}

/** Fixe l'état réseau et laisse React se redessiner (le store est hors React). */
async function etat(partiel: Partial<EtatConnectivite>) {
  await act(async () => {
    definirConnectivitePourTest(partiel);
  });
}

/** Met l'app hors ligne, puis attend que la barre apparaisse. */
async function horsLigne() {
  await etat({ connecte: false, internet: false, backend: false, enVerification: false });
  await waitFor(() => expect(screen.getByLabelText(fr.reseau.horsLigne)).toBeTruthy());
}

describe('indicateur réseau', () => {
  beforeEach(async () => {
    await etat({ connecte: true, internet: true, backend: true, enVerification: false });
  });

  it('ne montre rien quand l’application est en ligne', async () => {
    await rendre();
    expect(screen.queryByLabelText(fr.reseau.horsLigne)).toBeNull();
    expect(screen.queryByLabelText(fr.reseau.voir)).toBeNull();
  });

  it('montre la barre discrète à la perte du réseau, sans le texte long', async () => {
    await rendre();
    await horsLigne();
    // Le texte long n'est plus affiché en permanence : il appartient à la feuille.
    expect(screen.queryByText(fr.reseau.horsLigneTexte)).toBeNull();
  });

  it('montre la barre quand le backend est injoignable, interface active', async () => {
    await rendre();
    // Interface active mais sonde serveur en échec : l'indicateur ne doit pas prétendre être en ligne.
    await etat({ connecte: true, internet: true, backend: false, enVerification: false });
    await waitFor(() => expect(screen.getByLabelText(fr.reseau.horsLigne)).toBeTruthy());
  });

  it('la pastille ouvre une feuille qui explique le mode hors ligne', async () => {
    await rendre();
    await horsLigne();

    fireEvent.press(screen.getByLabelText(fr.reseau.voir));

    await waitFor(() => expect(screen.getByText(fr.reseau.horsLigneTexte)).toBeTruthy());
    fireEvent.press(screen.getByText(fr.reseau.compris));
    await waitFor(() => expect(screen.queryByText(fr.reseau.horsLigneTexte)).toBeNull());
  });

  it('signale une vérification en cours dans la feuille', async () => {
    await rendre();
    await horsLigne();
    await etat({ enVerification: true });

    fireEvent.press(screen.getByLabelText(fr.reseau.voir));

    await waitFor(() => expect(screen.getByText(fr.reseau.verification)).toBeTruthy());
  });

  it('disparaît au retour du réseau', async () => {
    await rendre();
    await horsLigne();

    await etat({ connecte: true, internet: true, backend: true, enVerification: false });
    await waitFor(() => expect(screen.queryByLabelText(fr.reseau.horsLigne)).toBeNull());
  });

  it('affiche l’expiration quand le temps simulé avance APRÈS la coupure', async () => {
    // Parcours réel de vérification : « forcer hors ligne », PUIS « +8 jours ». L'état réseau ne change pas entre
    // les deux, donc se fier au seul `estEnLigne` manquerait le cas et la feuille ne s'ouvrirait jamais.
    const JOUR = 24 * 3600 * 1000;
    definirDernierContactPourTest(Date.now() - 2 * JOUR);
    await rendre();
    await horsLigne();

    // Encore valable : la feuille parle du mode hors ligne, pas de l'expiration.
    fireEvent.press(screen.getByLabelText(fr.reseau.voir));
    await waitFor(() => expect(screen.getByText(fr.reseau.horsLigneTexte)).toBeTruthy());
    fireEvent.press(screen.getByText(fr.reseau.compris));
    await waitFor(() => expect(screen.queryByText(fr.reseau.horsLigneTexte)).toBeNull());

    // Le temps avance sans que l'état réseau bouge : la pastille doit recalculer.
    await act(async () => {
      simulerJoursEcoules(8);
    });

    fireEvent.press(screen.getByLabelText(fr.reseau.voir));
    await waitFor(() => expect(screen.getByText(fr.reseau.expireTexte)).toBeTruthy());

    // On remet le temps réel et l'absence de contact pour ne pas polluer les autres tests.
    await act(async () => {
      simulerJoursEcoules(0);
    });
    definirDernierContactPourTest(null);
  });
});
