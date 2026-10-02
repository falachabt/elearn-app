import { fireEvent, render, screen } from '@testing-library/react-native';

import { changerLangue } from '@/i18n';
import { fr } from '@/i18n/fr';
import { en } from '@/i18n/en';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { FeuilleMiseAJour } from '../FeuilleMiseAJour';

// Le mock officiel n'expose pas de BottomSheetView rendu : composants simples qui rendent leurs enfants.
jest.mock('@gorhom/bottom-sheet', () => {
  const passe = ({ children }: { children?: React.ReactNode }) => children ?? null;
  return { __esModule: true, default: passe, BottomSheetView: passe, BottomSheetModal: passe, BottomSheetModalProvider: passe, BottomSheetBackdrop: () => null };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const rendre = (props: Partial<React.ComponentProps<typeof FeuilleMiseAJour>> = {}) =>
  render(
    <ThemeProvider>
      <FeuilleMiseAJour etat="disponible" onInstaller={jest.fn()} onPlusTard={jest.fn()} {...props} />
    </ThemeProvider>,
  );

afterEach(async () => { await changerLangue('fr'); });

describe('FeuilleMiseAJour', () => {
  it.each([['fr', fr], ['en', en]] as const)('affiche les textes et les actions en %s', async (langue, textes) => {
    await changerLangue(langue);
    const onInstaller = jest.fn();
    const onPlusTard = jest.fn();
    await rendre({ onInstaller, onPlusTard });
    expect(screen.getByText(textes.miseAJour.titre)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: textes.miseAJour.mettreAJour }));
    expect(onInstaller).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: textes.miseAJour.plusTard })).toBeTruthy();
  });

  it('téléchargement : barre de progression, pas de boutons', async () => {
    await rendre({ etat: 'telechargement' });
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('erreur : bannière et « Réessayer »', async () => {
    const onInstaller = jest.fn();
    await rendre({ etat: 'erreur', onInstaller });
    expect(screen.getByText(fr.miseAJour.erreurTitre)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: fr.miseAJour.reessayer }));
    expect(onInstaller).toHaveBeenCalled();
  });

  it('obligatoire : plein écran sans « Plus tard »', async () => {
    await rendre({ obligatoire: true });
    expect(screen.getByText(fr.miseAJour.obligatoireTitre)).toBeTruthy();
    expect(screen.queryByRole('button', { name: fr.miseAJour.plusTard })).toBeNull();
    expect(screen.getByRole('button', { name: fr.miseAJour.mettreAJour })).toBeTruthy();
  });

  it('ne rend rien sans mise à jour', async () => {
    await rendre({ etat: 'aucune' });
    expect(screen.toJSON()).toBeNull();
  });
});
