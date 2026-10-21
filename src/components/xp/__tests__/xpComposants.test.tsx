import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BaremeXp } from '../BaremeXp';
import { CarteXp } from '../CarteXp';
import { AvatarNiveau } from '../AvatarNiveau';
import { DUREE_CONFETTIS_MS } from '../ConfettisCelebration';
import { DUREE_TOAST_LEVEL_UP_MS, DUREE_TOAST_XP_MS, ToastGainXp } from '../ToastGainXp';
import { emettreGainXp } from '@/services/xp';
import { ThemeProvider } from '@/theme/ThemeProvider';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => ({}),
}));

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (n: React.ReactElement) => render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair">{n}</ThemeProvider></SafeAreaProvider>);

describe('Composants XP & Niveaux (M4-07)', () => {
  describe('AvatarNiveau', () => {
    it('affiche le niveau 1 et l’initiale', async () => {
      await monter(<AvatarNiveau nom="Awa Kamga" totalXp={50} taille={44} />);
      expect(screen.getByText('A')).toBeTruthy();
      expect(screen.getByText('1')).toBeTruthy();
    });

    it('affiche le niveau 3 pour 340 XP avec couleur de palier', async () => {
      await monter(<AvatarNiveau nom="Benny" totalXp={340} taille={60} />);
      expect(screen.getByText('B')).toBeTruthy();
      expect(screen.getByText('3')).toBeTruthy();
    });

    it('affiche la photo de profil avec son accessibilityLabel et sans initiale', async () => {
      await monter(<AvatarNiveau photo="https://example.com/avatar.jpg" nom="Benny Falachabt" totalXp={100} taille={60} />);
      expect(screen.getByLabelText('Benny Falachabt')).toBeTruthy();
      expect(screen.queryByText('B')).toBeNull();
    });
  });

  describe('CarteXp', () => {
    it('affiche le niveau, les points XP et ouvre l’écran de barème au tap', async () => {
      await monter(<CarteXp totalXp={340} />);
      expect(screen.getByText('340')).toBeTruthy();
      expect(screen.getByText(/Niveau 3/)).toBeTruthy();

      const bouton = screen.getByRole('button');
      await fireEvent.press(bouton);

      expect(router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/xp' }));
    });
  });

  describe('BaremeXp', () => {
    it('affiche la règle d’or, le barème des gains et les paliers de niveau', async () => {
      await monter(<BaremeXp totalXp={340} />);

      // Titre & Règle d’or
      expect(screen.getByText('Barème & Niveaux XP')).toBeTruthy();
      expect(screen.getByText(/valeur monétaire/)).toBeTruthy();

      // Actions du barème
      expect(screen.getByText(/Bonne réponse à un quiz/)).toBeTruthy();
      expect(screen.getAllByText('+10 XP').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Mission du jour terminée/)).toBeTruthy();
      expect(screen.getByText('+50 XP')).toBeTruthy();

      // Paliers
      expect(screen.getByText('Débutant')).toBeTruthy();
      expect(screen.getByText('Confirmé')).toBeTruthy();
      expect(screen.getByText('Légende')).toBeTruthy();
    });

    it('le bouton retour permet de revenir en arrière', async () => {
      await monter(<BaremeXp totalXp={0} />);
      const btnRetour = screen.getByRole('button', { name: 'Retour' });
      await fireEvent.press(btnRetour);
      expect(router.back).toHaveBeenCalled();
    });
  });

  describe('ToastGainXp', () => {
    it('affiche un toast lors d’un gain d’XP puis réagit au tap', async () => {
      await monter(<ToastGainXp />);

      // Au début, rien n'est affiché
      expect(screen.queryByText('+50 XP')).toBeNull();

      // Émission d'un gain de mission
      await act(async () => {
        emettreGainXp({ gain: 50, total: 50, source: 'daily_mission' });
      });

      // Le toast apparaît avec le titre et le sous-titre
      expect(await screen.findByText('+50 XP')).toBeTruthy();
      expect(screen.getByText('Mission du jour accomplie !')).toBeTruthy();

      // Tap sur le toast pour ouvrir le barème
      await fireEvent.press(screen.getByText('+50 XP'));
      expect(router.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/xp' }));
    });

    it('affiche un toast spécial de déblocage lors d’un passage de niveau', async () => {
      await monter(<ToastGainXp />);

      // Émission d'un gain faisant passer au niveau 2 (Apprenti à partir de 100 XP)
      await act(async () => {
        emettreGainXp({ gain: 30, total: 110, source: 'quiz' });
      });

      expect(await screen.findByText('Niveau 2 débloqué !')).toBeTruthy();
      expect(screen.getByText('Tu passes au rang Apprenti !')).toBeTruthy();
    });

    it('confettis du passage de niveau : toujours là après la fermeture du toast, retirés ensuite, absents sans niveau', async () => {
      jest.useFakeTimers();
      try {
        await monter(<ToastGainXp />);
        await act(async () => { emettreGainXp({ gain: 5, total: 20, source: 'quiz' }); });
        expect(screen.queryByTestId('confettis')).toBeNull();
        await act(async () => { await jest.advanceTimersByTimeAsync(DUREE_TOAST_XP_MS + 100); });

        await act(async () => { emettreGainXp({ gain: 30, total: 110, source: 'quiz' }); });
        expect(screen.getByTestId('confettis')).toBeTruthy();
        await act(async () => { await jest.advanceTimersByTimeAsync(DUREE_TOAST_LEVEL_UP_MS + 500); });
        expect(screen.queryByText('Niveau 2 débloqué !')).toBeNull();
        expect(screen.getByTestId('confettis')).toBeTruthy();
        expect(DUREE_CONFETTIS_MS).toBeGreaterThanOrEqual(3.5 * 2600);
        await act(async () => { await jest.advanceTimersByTimeAsync(DUREE_CONFETTIS_MS); });
        expect(screen.queryByTestId('confettis')).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
