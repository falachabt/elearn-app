import AsyncStorage from '@react-native-async-storage/async-storage';

import { bandeauFermeRecemment, ecranSansBandeau, fermerBandeau, magasinsAffiches, plateformeWeb } from '../bandeauApplication';

const liens = { play: 'https://play/x', appstore: 'https://apps/x' };

beforeEach(() => AsyncStorage.clear());

describe('bandeau application (web)', () => {
  it('reconnaît Android, iPhone, iPad (se disant Mac, avec écran tactile) et ordinateur', () => {
    expect(plateformeWeb('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('android');
    expect(plateformeWeb('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios');
    expect(plateformeWeb('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios');
    expect(plateformeWeb('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('bureau');
    expect(plateformeWeb('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('bureau');
  });

  it('un magasin selon la plateforme, les deux sur ordinateur', () => {
    expect(magasinsAffiches('android', liens).map((m) => m.magasin)).toEqual(['play']);
    expect(magasinsAffiches('ios', liens).map((m) => m.magasin)).toEqual(['appstore']);
    expect(magasinsAffiches('bureau', liens).map((m) => m.magasin)).toEqual(['play', 'appstore']);
  });

  it('un bouton sans lien configuré est masqué ; sans aucun lien, rien à afficher', () => {
    expect(magasinsAffiches('bureau', { play: 'https://play/x', appstore: null }).map((m) => m.magasin)).toEqual(['play']);
    expect(magasinsAffiches('ios', { play: 'https://play/x', appstore: null })).toEqual([]);
    expect(magasinsAffiches('bureau', { play: null, appstore: null })).toEqual([]);
  });

  it('jamais sur la photo, le paiement, le lien parent ni l’épreuve chronométrée', () => {
    for (const c of ['/photo', '/offres/payer', '/offres/parent', '/paiements', '/paiements/abc', '/annales/sujet']) expect(ecranSansBandeau(c)).toBe(true);
    for (const c of ['/', '/moi', '/offres', '/annales/concours', '/reviser']) expect(ecranSansBandeau(c)).toBe(false);
  });

  it('fermé, il ne revient pas avant 7 jours', async () => {
    const t0 = new Date('2026-10-07T10:00:00Z');
    expect(await bandeauFermeRecemment(t0)).toBe(false);
    await fermerBandeau(t0);
    expect(await bandeauFermeRecemment(new Date('2026-10-13T09:00:00Z'))).toBe(true);
    expect(await bandeauFermeRecemment(new Date('2026-10-14T10:00:01Z'))).toBe(false);
  });

  it('stockage indisponible : il s’affiche, sans erreur', async () => {
    const lire = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('indisponible'));
    const ecrire = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('indisponible'));
    expect(await bandeauFermeRecemment()).toBe(false);
    await expect(fermerBandeau()).resolves.toBeUndefined();
    lire.mockRestore();
    ecrire.mockRestore();
  });
});
