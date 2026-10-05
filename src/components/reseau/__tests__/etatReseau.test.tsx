import { render, screen, waitFor } from '@testing-library/react-native';

import { fr } from '@/i18n/fr';
import { definirConnectivitePourTest, demarrerConnectivite } from '@/services/connectivite';

import { EtatReseau } from '../EtatReseau';

describe('indicateur réseau', () => {
  beforeEach(() => {
    definirConnectivitePourTest({ connecte: true, internet: true, backend: true });
  });

  it('ne montre rien quand l’application est en ligne', async () => {
    await render(<EtatReseau />);
    expect(screen.queryByText(fr.reseau.horsLigne)).toBeNull();
  });

  it('affiche l’état hors ligne à la perte du réseau', async () => {
    await render(<EtatReseau />);
    definirConnectivitePourTest({ connecte: false, internet: false, backend: false });

    await waitFor(() => expect(screen.getByText(fr.reseau.horsLigne)).toBeTruthy());
    expect(screen.getByText(fr.reseau.horsLigneTexte)).toBeTruthy();
  });

  it('affiche l’état hors ligne quand le backend est injoignable, interface active', async () => {
    await render(<EtatReseau />);
    // Interface active mais sonde serveur en échec : l'indicateur ne doit pas prétendre être en ligne.
    definirConnectivitePourTest({ connecte: true, internet: true, backend: false });

    await waitFor(() => expect(screen.getByText(fr.reseau.horsLigne)).toBeTruthy());
  });

  it('disparaît au retour du réseau', async () => {
    await render(<EtatReseau />);
    definirConnectivitePourTest({ connecte: false, internet: false, backend: false });
    await waitFor(() => expect(screen.getByText(fr.reseau.horsLigne)).toBeTruthy());

    definirConnectivitePourTest({ connecte: true, internet: true, backend: true });
    await waitFor(() => expect(screen.queryByText(fr.reseau.horsLigne)).toBeNull());
  });

  it('arrête l’observation réseau au démontage', () => {
    const arret = demarrerConnectivite({ sonderAuDemarrage: false });
    expect(() => arret()).not.toThrow();
  });
});
