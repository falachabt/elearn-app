import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';

import { changerLangue } from '@/i18n';
import { suivre } from '@/services/analytics';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { MentionsLegales, lienCgu, urlSite } from '../MentionsLegales';

jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => ({ type: 'opened' })) }));

afterAll(() => changerLangue('fr'));

describe('MentionsLegales', () => {
  beforeEach(() => jest.clearAllMocks());

  it('builds the legal URLs from the configured site', () => {
    expect(urlSite('cgu', 'https://elearnprepa.com/')).toBe('https://elearnprepa.com/fr/cgu');
    expect(lienCgu()).toMatch(/^https:\/\/.+\/fr\/cgu$/);
  });

  it.each(['fr', 'en'] as const)('opens the terms and the privacy policy from the sentence (%s)', async (langue) => {
    await act(() => changerLangue(langue));
    await render(<ThemeProvider reglage="clair"><MentionsLegales /></ThemeProvider>);
    const [cgu, confidentialite] = screen.getAllByRole('link');
    await fireEvent.press(cgu);
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(lienCgu());
    expect(suivre).toHaveBeenCalledWith('legal_opened', { page: 'cgu' });
    await fireEvent.press(confidentialite);
    expect(WebBrowser.openBrowserAsync).toHaveBeenLastCalledWith(expect.stringMatching(/\/fr\/confidentialite$/));
  });
});
