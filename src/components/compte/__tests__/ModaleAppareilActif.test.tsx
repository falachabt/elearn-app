import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { ThemeProvider } from '@/theme/ThemeProvider';
import { ModaleAppareilActif } from '../ModaleAppareilActif';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

describe('ModaleAppareilActif · Respect Design System & Règles Métier', () => {
  it('affiche le message de déconnexion quand la session a été ouverte ailleurs', async () => {
    const surFermer = jest.fn();
    await render(
      <ThemeProvider reglage="clair">
        <ModaleAppareilActif visible={true} type="deconnecte" surFermer={surFermer} />
      </ThemeProvider>,
    );

    expect(screen.getByText('Session ouverte ailleurs')).toBeTruthy();
    expect(screen.getByText(/Ton compte a été connecté sur un autre appareil\./)).toBeTruthy();

    await fireEvent.press(screen.getByText('Se reconnecter'));
    expect(surFermer).toHaveBeenCalledTimes(1);
  });

  it('affiche le message de limite et propose le lien vers le support', async () => {
    const spyOpenURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
    const surFermer = jest.fn();
    await render(
      <ThemeProvider reglage="clair">
        <ModaleAppareilActif visible={true} type="limite" surFermer={surFermer} />
      </ThemeProvider>,
    );

    expect(screen.getByText('Limite d’appareils atteinte')).toBeTruthy();
    expect(screen.getByText(/Tu as déjà changé 3 fois d’appareil ce mois-ci/)).toBeTruthy();

    await fireEvent.press(screen.getByText('Contacter le support'));
    expect(spyOpenURL).toHaveBeenCalledWith(expect.stringContaining('wa.me'));

    await fireEvent.press(screen.getByText('Compris'));
    expect(surFermer).toHaveBeenCalledTimes(1);

    spyOpenURL.mockRestore();
  });
});
