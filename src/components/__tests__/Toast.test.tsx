import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Button } from 'react-native';

import { ThemeProvider } from '@/theme/ThemeProvider';
import { ToastProvider, useToast } from '../Toast';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

function ComposantTest() {
  const { afficherToast, masquerToast } = useToast();
  return (
    <>
      <Button
        title="Toast Info"
        onPress={() => afficherToast({ titre: 'Information importante', message: 'Détail de l’info', type: 'info', dureeMs: 50 })}
      />
      <Button
        title="Toast Succes"
        onPress={() => afficherToast({ titre: 'Action réussie !', type: 'succes', dureeMs: 0 })}
      />
      <Button title="Fermer" onPress={masquerToast} />
    </>
  );
}

describe('ToastProvider & useToast (Design System Néo-Brutaliste)', () => {
  it('affiche un toast info avec titre et message, puis disparaît au timeout', async () => {
    await render(
      <ThemeProvider reglage="clair">
        <ToastProvider>
          <ComposantTest />
        </ToastProvider>
      </ThemeProvider>,
    );

    expect(screen.queryByText('Information importante')).toBeNull();

    await fireEvent.press(screen.getByText('Toast Info'));
    expect(screen.getByText('Information importante')).toBeTruthy();
    expect(screen.getByText('Détail de l’info')).toBeTruthy();

    await waitFor(() => expect(screen.queryByText('Information importante')).toBeNull(), { timeout: 1500 });
  });

  it('affiche un toast succès et se ferme manuellement via le bouton fermer', async () => {
    await render(
      <ThemeProvider reglage="clair">
        <ToastProvider>
          <ComposantTest />
        </ToastProvider>
      </ThemeProvider>,
    );

    await fireEvent.press(screen.getByText('Toast Succes'));
    expect(screen.getByText('Action réussie !')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Fermer'));
    await waitFor(() => expect(screen.queryByText('Action réussie !')).toBeNull(), { timeout: 1500 });
  });
});
