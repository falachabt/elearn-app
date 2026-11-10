import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CLE_CONSENTEMENT,
  CLE_IDENTITE,
  analyticsActif,
  attendreAnalyticsPret,
  consentementActif,
  definirConsentement,
  definirProprietesGlobales,
  definirProprietesUtilisateur,
  identifier,
  initAnalytics,
  lireEcranCourant,
  reinitialiserAnalyticsPourTests,
  reinitialiserIdentite,
  suivre,
  suivreEcran,
  suivreException,
} from '../analytics';
import type { Evenements } from '../evenements';

const mockCapture = jest.fn();
const mockIdentify = jest.fn();
const mockAlias = jest.fn();
const mockReset = jest.fn();
const mockScreen = jest.fn();
const mockSetPerson = jest.fn();
const mockRegister = jest.fn();
const mockException = jest.fn();
const mockOptIn = jest.fn(() => Promise.resolve());
const mockOptOut = jest.fn(() => Promise.resolve());
const mockFlush = jest.fn(() => Promise.resolve());
const mockConstructeur = jest.fn();
jest.mock('posthog-react-native', () => ({
  __esModule: true,
  default: function PostHog(...args: unknown[]) {
    mockConstructeur(...args);
    return {
      capture: mockCapture,
      identify: mockIdentify,
      alias: mockAlias,
      reset: mockReset,
      screen: mockScreen,
      setPersonProperties: mockSetPerson,
      register: mockRegister,
      captureException: mockException,
      optIn: mockOptIn,
      optOut: mockOptOut,
      flush: mockFlush,
    };
  },
}));

beforeEach(async () => {
  jest.clearAllMocks();
  reinitialiserAnalyticsPourTests();
  await AsyncStorage.clear();
});

async function demarrer() {
  initAnalytics({ cle: 'phc_test', hote: 'https://h.example' });
  await attendreAnalyticsPret();
}

describe('analytics', () => {
  it('est désactivé sans clé, sans erreur', async () => {
    expect(initAnalytics({})).toBe(false);
    expect(analyticsActif()).toBe(false);
    expect(() => suivre('app_opened', { plateforme: 'ios' })).not.toThrow();
    await expect(identifier('u1', { invite: true })).resolves.toBeUndefined();
    expect(mockConstructeur).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('configure le SDK : file persistée bornée, suivi d’erreurs, garde-fou avant envoi', async () => {
    await demarrer();
    const [cle, options] = mockConstructeur.mock.calls[0] as [string, Record<string, unknown>];
    expect(cle).toBe('phc_test');
    expect(options).toMatchObject({ host: 'https://h.example', maxQueueSize: 2000, captureAppLifecycleEvents: true });
    expect(options.errorTracking).toEqual({ autocapture: { uncaughtExceptions: true, unhandledRejections: true, console: false } });
    expect(typeof options.before_send).toBe('function');
  });

  it('le garde-fou ajoute écran et état hors ligne, et retire les données personnelles', async () => {
    await demarrer();
    suivreEcran('/cours/lecon');
    const { before_send } = mockConstructeur.mock.calls[0][1] as { before_send: (e: unknown) => { properties: Record<string, unknown> } | null };
    const sortie = before_send({ event: 'x', properties: { score: 3, email: 'a@b.cd', message: 'appel +237 612 345 678' } });
    expect(sortie?.properties).toMatchObject({ score: 3, ecran: '/cours/lecon', message: 'appel [numero]' });
    expect(sortie?.properties).not.toHaveProperty('email');
    expect(sortie?.properties).toHaveProperty('hors_ligne');
    expect(before_send(null)).toBeNull();
  });

  it('envoie les événements avec une clé', async () => {
    await demarrer();
    suivre('session_invite_creee', {});
    expect(mockCapture).toHaveBeenCalledWith('session_invite_creee', {});
  });

  it('retient les évènements demandés avant la lecture du consentement, puis les envoie', async () => {
    initAnalytics({ cle: 'phc_test' });
    suivre('session_invite_creee', {});
    expect(mockCapture).not.toHaveBeenCalled();
    await attendreAnalyticsPret();
    expect(mockCapture).toHaveBeenCalledWith('session_invite_creee', {});
  });

  it('suit les écrans, les exceptions et retient l’écran courant', async () => {
    await demarrer();
    suivreEcran('/offres', '/moi');
    suivreException(new Error('boum'), { origine: 'boundary' });
    expect(mockScreen).toHaveBeenCalledWith('/offres', { precedent: '/moi' });
    expect(mockException).toHaveBeenCalledWith(expect.any(Error), { origine: 'boundary' });
    expect(lireEcranCourant()).toBe('/offres');
  });

  describe('identité', () => {
    it('identifie sans e-mail, une seule fois par utilisateur', async () => {
      await demarrer();
      await identifier('u1', { invite: true });
      await identifier('u1', { invite: true });
      expect(mockIdentify).toHaveBeenCalledTimes(1);
      expect(mockIdentify).toHaveBeenCalledWith('u1', { invite: true });
      expect(JSON.parse((await AsyncStorage.getItem(CLE_IDENTITE)) ?? '{}')).toEqual({ id: 'u1', invite: true });
    });

    it('invité qui crée un compte avec le même identifiant : pas d’alias, propriété mise à jour', async () => {
      await demarrer();
      await identifier('u1', { invite: true });
      await identifier('u1', { invite: false });
      expect(mockIdentify).toHaveBeenLastCalledWith('u1', { invite: false });
      expect(mockAlias).not.toHaveBeenCalled();
    });

    it('invité qui devient un autre utilisateur (Apple, ancien compte) : alias de l’invité vers le compte', async () => {
      await demarrer();
      await identifier('invite-1', { invite: true });
      await identifier('compte-2', { invite: false });
      expect(mockIdentify).toHaveBeenLastCalledWith('compte-2', { invite: false });
      expect(mockAlias).toHaveBeenCalledWith('invite-1');
    });

    it('compte qui change pour un autre compte : aucun alias', async () => {
      await demarrer();
      await identifier('compte-1', { invite: false });
      await identifier('compte-2', { invite: false });
      expect(mockAlias).not.toHaveBeenCalled();
    });

    it('se souvient de l’identité après un redémarrage (alias même si l’app a été tuée entre les deux)', async () => {
      await demarrer();
      await identifier('invite-1', { invite: true });
      reinitialiserAnalyticsPourTests();
      await demarrer();
      await identifier('compte-2', { invite: false });
      expect(mockAlias).toHaveBeenCalledWith('invite-1');
    });

    it('déconnexion : envoie la file, repart d’un visiteur anonyme et oublie l’identité', async () => {
      await demarrer();
      await identifier('compte-1', { invite: false });
      await reinitialiserIdentite();
      expect(mockFlush).toHaveBeenCalled();
      expect(mockReset).toHaveBeenCalledTimes(1);
      expect(await AsyncStorage.getItem(CLE_IDENTITE)).toBeNull();
      // Le prochain invité est identifié à son tour, sans alias vers l’ancien compte.
      await identifier('invite-2', { invite: true });
      expect(mockIdentify).toHaveBeenLastCalledWith('invite-2', { invite: true });
      expect(mockAlias).not.toHaveBeenCalled();
    });
  });

  describe('propriétés de la personne', () => {
    it('envoie seulement ce qui a changé', async () => {
      await demarrer();
      definirProprietesUtilisateur({ classe: '3e', statut: 'eleve' });
      definirProprietesUtilisateur({ classe: '3e', statut: 'eleve' });
      definirProprietesUtilisateur({ classe: '2nde', statut: 'eleve', pass_actif: false });
      expect(mockSetPerson).toHaveBeenCalledTimes(2);
      expect(mockSetPerson).toHaveBeenNthCalledWith(1, { classe: '3e', statut: 'eleve' });
      expect(mockSetPerson).toHaveBeenNthCalledWith(2, { classe: '2nde', pass_actif: false });
    });

    it('renvoie tout après un changement d’identité', async () => {
      await demarrer();
      definirProprietesUtilisateur({ classe: '3e' });
      await identifier('u2', { invite: true });
      definirProprietesUtilisateur({ classe: '3e' });
      expect(mockSetPerson).toHaveBeenCalledTimes(2);
    });

    it('retire les propriétés sensibles et enregistre les propriétés globales', async () => {
      await demarrer();
      definirProprietesUtilisateur({ classe: '3e', email: 'a@b.cd' });
      expect(mockSetPerson).toHaveBeenCalledWith({ classe: '3e' });
      definirProprietesGlobales({ version_app: '3.1.0' });
      expect(mockRegister).toHaveBeenCalledWith({ version_app: '3.1.0' });
    });
  });

  describe('consentement', () => {
    it('refus mémorisé : plus aucun envoi, au démarrage suivant aussi', async () => {
      await AsyncStorage.setItem(CLE_CONSENTEMENT, '0');
      await demarrer();
      expect(consentementActif()).toBe(false);
      expect(mockOptOut).toHaveBeenCalled();
      suivre('session_invite_creee', {});
      await identifier('u1', { invite: true });
      definirProprietesUtilisateur({ classe: '3e' });
      expect(mockCapture).not.toHaveBeenCalled();
      expect(mockIdentify).not.toHaveBeenCalled();
      expect(mockSetPerson).not.toHaveBeenCalled();
    });

    it('refuser depuis les paramètres : annonce le refus, envoie une dernière fois, puis coupe', async () => {
      await demarrer();
      await definirConsentement(false);
      expect(mockCapture).toHaveBeenCalledWith('analytics_consent_changed', { actif: false });
      expect(mockFlush).toHaveBeenCalled();
      expect(mockOptOut).toHaveBeenCalled();
      expect(await AsyncStorage.getItem(CLE_CONSENTEMENT)).toBe('0');
      mockCapture.mockClear();
      suivre('session_invite_creee', {});
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it('accepter à nouveau reprend le suivi', async () => {
      await demarrer();
      await definirConsentement(false);
      await definirConsentement(true);
      expect(mockOptIn).toHaveBeenCalled();
      expect(mockCapture).toHaveBeenCalledWith('analytics_consent_changed', { actif: true });
      suivre('session_invite_creee', {});
      expect(mockCapture).toHaveBeenLastCalledWith('session_invite_creee', {});
    });

    it('la déconnexion garde le refus (le SDK l’efface au reset)', async () => {
      await AsyncStorage.setItem(CLE_CONSENTEMENT, '0');
      await demarrer();
      mockOptOut.mockClear();
      await reinitialiserIdentite();
      expect(mockOptOut).toHaveBeenCalledTimes(1);
    });
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
