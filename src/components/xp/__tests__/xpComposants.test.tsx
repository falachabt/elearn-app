import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BaremeXp } from '../BaremeXp';
import { CarteXp } from '../CarteXp';
import { AvatarNiveau } from '../AvatarNiveau';
import { ToastGainXp } from '../ToastGainXp';
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
  });
});
