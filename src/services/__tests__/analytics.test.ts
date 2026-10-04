import { analyticsActif, identifier, initAnalytics, reinitialiserAnalyticsPourTests, suivre } from '../analytics';
import type { Evenements } from '../evenements';

const mockCapture = jest.fn();
const mockIdentify = jest.fn();
const mockConstructeur = jest.fn();
jest.mock('posthog-react-native', () => ({
  __esModule: true,
  default: function PostHog(...args: unknown[]) {
    mockConstructeur(...args);
    return { capture: mockCapture, identify: mockIdentify };
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  reinitialiserAnalyticsPourTests();
});

describe('analytics', () => {
  it('est désactivé sans clé, sans erreur', () => {
    expect(initAnalytics({})).toBe(false);
    expect(analyticsActif()).toBe(false);
    expect(() => suivre('app_opened', { plateforme: 'ios' })).not.toThrow();
    expect(() => identifier('u1')).not.toThrow();
    expect(mockConstructeur).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('envoie les événements avec une clé', () => {
    expect(initAnalytics({ cle: 'phc_test', hote: 'https://h.example' })).toBe(true);
    suivre('session_invite_creee', {});
    identifier('u1');
    identifier('u2', { email: 'a@b.c', invite: false });
    expect(mockConstructeur).toHaveBeenCalledWith('phc_test', { host: 'https://h.example' });
    expect(mockCapture).toHaveBeenCalledWith('session_invite_creee', {});
    expect(mockIdentify).toHaveBeenCalledWith('u1', {});
    expect(mockIdentify).toHaveBeenCalledWith('u2', { email: 'a@b.c', invite: false });
  });

  it('type le dictionnaire d’événements', () => {
    const ok: Evenements['erreur_ecran'] = { message: 'x', origine: 'boundary' };
    expect(ok.origine).toBe('boundary');
    // @ts-expect-error propriété inconnue pour app_opened
    suivre('app_opened', { inconnue: 1 });
    // @ts-expect-error événement absent du dictionnaire
    suivre('evenement_inconnu', {});
  });
});
