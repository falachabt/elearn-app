import { render, screen, waitFor } from '@testing-library/react-native';

import EcranParrainage from '@/app/parrainage/index';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { themes } from '@/theme/theme';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve()) }));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/services/supabase', () => ({ getSupabase: jest.fn().mockReturnValue({}) }));

jest.mock('@/services/parrainage', () => ({
  ...jest.requireActual('@/services/parrainage'),
  chargerStatsParrainage: jest.fn().mockResolvedValue({
    code: 'ELEARN2026',
    liensCliques: 3,
    comptesCrees: 1,
    passAchetes: 0,
    creditsGagnes: 20,
    jalons: [
      { id: 'j1', referrals_needed: 1, reward_type: 'credits', reward_value: 20, label_fr: 'Premier filleul', label_en: 'First referral', unlocked: true, claimed: false },
    ],
  }),
}));

jest.mock('@/session/SessionProvider', () => ({
  useSession: () => ({ session: { user: { id: 'u1', email: 'benny@example.com', user_metadata: { firstname: 'Benny' } } } }),
}));

const rendre = (reglage: 'clair' | 'sombre') => render(<ThemeProvider reglage={reglage}><EcranParrainage /></ThemeProvider>);

/**
 * Régression mode sombre : le bouton « Copier » de la carte « TON CODE » est posé sur `fond.surface`.
 * Il portait une encre noire codée en dur (#0A0A0A), illisible sur la surface sombre #1F221F.
 */
describe('Parrainage · contraste du bouton Copier', () => {
  it('mode sombre : le libellé suit l’encre du thème (pas de noir codé en dur)', async () => {
    rendre('sombre');
    await waitFor(() => expect(screen.getByText('Copier')).toBeTruthy());
    expect(screen.getByText('Copier')).toHaveStyle({ color: themes.dark.texte.principal });
    expect(themes.dark.texte.principal).not.toBe(themes.dark.texte.surCouleur);
  });

  it('mode clair : le rendu ne change pas (encre noire sur surface blanche)', async () => {
    rendre('clair');
    await waitFor(() => expect(screen.getByText('Copier')).toBeTruthy());
    expect(screen.getByText('Copier')).toHaveStyle({ color: themes.light.texte.principal });
  });

  it('mode sombre : le badge « Réclamé » garde l’encre des aplats vifs (émeraude)', async () => {
    rendre('sombre');
    await waitFor(() => expect(screen.getByText('Réclamé')).toBeTruthy());
    expect(screen.getByText('Réclamé')).toHaveStyle({ color: themes.dark.texte.surCouleur });
  });
});
