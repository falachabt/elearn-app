import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { CompteurQuotaIA } from '../Photo';
import { ThemeProvider } from '@/theme/ThemeProvider';

const monter = (ui: React.ReactElement) => render(<ThemeProvider reglage="clair">{ui}</ThemeProvider>);

describe('CompteurQuotaIA (Issue #10)', () => {
  it('affiche le compteur en vert quand il reste plus de 2 questions', async () => {
    await monter(<CompteurQuotaIA quota={{ used: 1, daily_limit: 5, remaining: 4, unlimited: false }} />);
    expect(await screen.findByText('4 questions IA restantes aujourd’hui')).toBeTruthy();
  });

  it('affiche le compteur au singulier quand il reste 1 question (orange)', async () => {
    await monter(<CompteurQuotaIA quota={{ used: 4, daily_limit: 5, remaining: 1, unlimited: false }} />);
    expect(await screen.findByText('1 question IA restante aujourd’hui')).toBeTruthy();
  });

  it('affiche 0 question et le message clair et non culpabilisant quand quota épuisé', async () => {
    await monter(<CompteurQuotaIA quota={{ used: 5, daily_limit: 5, remaining: 0, unlimited: false }} />);
    expect(await screen.findByText('0 question IA restante aujourd’hui')).toBeTruthy();
    expect(screen.getByText('Tu as utilisé toutes tes questions IA d’aujourd’hui. Elles reviennent cette nuit à minuit.')).toBeTruthy();
  });

  it('masque le bloc d’explication quand discret est activé', async () => {
    await monter(<CompteurQuotaIA quota={{ used: 5, daily_limit: 5, remaining: 0, unlimited: false }} discret />);
    expect(await screen.findByText('0 question IA restante aujourd’hui')).toBeTruthy();
    expect(screen.queryByText('Tu as utilisé toutes tes questions IA d’aujourd’hui. Elles reviennent cette nuit à minuit.')).toBeNull();
  });
});
