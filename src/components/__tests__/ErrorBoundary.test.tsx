import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ThemeProvider } from '@/theme/ThemeProvider';

import { ErrorBoundary } from '../ErrorBoundary';

const mockSuivre = jest.fn();
jest.mock('@/services/analytics', () => ({ suivre: (...a: unknown[]) => mockSuivre(...a) }));

function Casse(): never {
  throw new Error('boum');
}

describe('ErrorBoundary', () => {
  it('affiche le repli en français et journalise', async () => {
    const consoleErr = jest.spyOn(console, 'error').mockImplementation(() => {});
    await render(
      <ThemeProvider>
        <ErrorBoundary>
          <Casse />
        </ErrorBoundary>
      </ThemeProvider>,
    );
    expect(screen.getByText('Un problème est survenu')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
    expect(mockSuivre).toHaveBeenCalledWith('erreur_ecran', expect.objectContaining({ message: 'boum', origine: 'boundary' }));
    expect(consoleErr).toHaveBeenCalled();
    consoleErr.mockRestore();
  });

  it('rend les enfants sans erreur', async () => {
    await render(
      <ThemeProvider>
        <ErrorBoundary>
          <Text>ok</Text>
        </ErrorBoundary>
      </ThemeProvider>,
    );
    expect(screen.getByText('ok')).toBeTruthy();
  });
});
