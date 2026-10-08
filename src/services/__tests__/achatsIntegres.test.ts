import { acheterPass, achatIntegreDisponible, attendreAcces, lirePrixApple, restaurerAchats, type Package, type SdkAchats } from '../achatsIntegres';

const paquet = (identifier: string, priceString: string): Package => ({ identifier, product: { priceString, price: 1, currencyCode: 'EUR' } });
const faux = (surcharge: Partial<SdkAchats> = {}): SdkAchats => ({
  configure: jest.fn(),
  logIn: jest.fn(async () => ({})),
  logOut: jest.fn(async () => ({})),
  getOfferings: jest.fn(async () => ({ current: { availablePackages: [paquet('week', '1,99 €'), paquet('month', '4,99 €'), paquet('inconnu', '9,99 €')] } })),
  purchasePackage: jest.fn(async () => ({})),
  restorePurchases: jest.fn(async () => ({})),
  ...surcharge,
});

describe('achats intégrés Apple', () => {
  const cleOrigine = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  afterEach(() => {
    if (cleOrigine === undefined) delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    else process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = cleOrigine;
  });

  it('disponible seulement sur iOS et avec une clé publique', () => {
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    expect(achatIntegreDisponible('ios')).toBe(false);
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY = 'appl_test';
    expect(achatIntegreDisponible('ios')).toBe(true);
    expect(achatIntegreDisponible('android')).toBe(false);
    expect(achatIntegreDisponible('web')).toBe(false);
  });

  it('lit les prix d’Apple pour les seuls pass connus', async () => {
    const prix = await lirePrixApple(faux());
    expect(Object.keys(prix).sort()).toEqual(['month', 'week']);
    expect(prix.week?.prix).toBe('1,99 €');
  });

  it('sans offre courante : aucun prix', async () => {
    expect(await lirePrixApple(faux({ getOfferings: jest.fn(async () => ({ current: null })) }))).toEqual({});
  });

  it('achat réussi', async () => {
    const sdk = faux();
    expect(await acheterPass(paquet('week', '1,99 €'), sdk)).toBe('achete');
    expect(sdk.purchasePackage).toHaveBeenCalledTimes(1);
  });

  it('annulation par l’utilisateur : pas d’erreur', async () => {
    const sdk = faux({ purchasePackage: jest.fn(async () => { throw Object.assign(new Error('annulé'), { userCancelled: true }); }) });
    expect(await acheterPass(paquet('week', '1,99 €'), sdk)).toBe('annule');
  });

  it('autre erreur d’achat : remontée', async () => {
    const sdk = faux({ purchasePackage: jest.fn(async () => { throw new Error('réseau'); }) });
    await expect(acheterPass(paquet('week', '1,99 €'), sdk)).rejects.toThrow('réseau');
  });

  it('restaurer les achats', async () => {
    const sdk = faux();
    await restaurerAchats(sdk);
    expect(sdk.restorePurchases).toHaveBeenCalledTimes(1);
  });

  it('attend que le serveur ait créé l’accès', async () => {
    const lire = jest.fn().mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ offre: 'week' });
    expect(await attendreAcces(lire, 5, 1)).toEqual({ offre: 'week' });
    expect(lire).toHaveBeenCalledTimes(3);
  });

  it('abandonne après les essais', async () => {
    expect(await attendreAcces(async () => null, 2, 1)).toBeNull();
  });
});
