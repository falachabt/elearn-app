import { Platform } from 'react-native';

import type { CodeOffre } from './pass';

/**
 * Achats intégrés Apple via RevenueCat (règle 3.1.1 de l'App Store : tout contenu numérique vendu dans l'app iOS passe par
 * StoreKit). iOS seulement. Android garde Mobile Money (pawaPay, voir plateforme.ts) ; les deux ne se croisent jamais.
 *
 * Convention RevenueCat (à créer dans le tableau de bord, voir docs/app-store.md) :
 * - une offre « default » dont les packages ont pour identifiant `week`, `month` et `contest` (les codes de `pass_products`) ;
 * - un droit unique « pass », attaché aux trois produits ;
 * - l'identifiant d'utilisateur RevenueCat est l'identifiant Supabase : le webhook RevenueCat crée l'accès côté serveur
 *   (`entitlement`, lu ensuite par `my_access`), comme `record_deposit_result` le fait pour pawaPay.
 * Sans clé publique (`EXPO_PUBLIC_REVENUECAT_IOS_KEY`), `achatIntegreDisponible()` est faux et l'écran des offres garde son
 * message « bientôt ».
 */

/** Sous-ensemble du SDK `react-native-purchases` utilisé ici (permet de le remplacer dans les tests). */
export type Package = { identifier: string; product: { priceString: string; price: number; currencyCode: string } };
export type SdkAchats = {
  configure(p: { apiKey: string; appUserID?: string | null }): void | Promise<void>;
  logIn(id: string): Promise<unknown>;
  logOut(): Promise<unknown>;
  getOfferings(): Promise<{ current: { availablePackages: Package[] } | null }>;
  purchasePackage(p: Package): Promise<unknown>;
  restorePurchases(): Promise<unknown>;
};

export type PrixApple = Partial<Record<CodeOffre, { prix: string; paquet: Package }>>;
export type ResultatAchat = 'achete' | 'annule';

const cle = () => process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY?.trim() || '';

export const achatIntegreDisponible = (os: string = Platform.OS): boolean => os === 'ios' && cle().length > 0;

let sdkCharge: SdkAchats | null = null;
let configure = false;

/** Chargement différé : le module natif n'est jamais importé sur Android, sur le web ni sous Jest. */
function sdk(): SdkAchats {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sdkCharge ??= (require('react-native-purchases') as { default: SdkAchats }).default;
  return sdkCharge;
}

/** Configure RevenueCat une seule fois. `utilisateur` relie les achats au compte Supabase (invité compris). */
export async function configurerAchats(utilisateur: string | null, depuis: SdkAchats = sdk()): Promise<void> {
  if (!achatIntegreDisponible()) return;
  if (!configure) {
    await depuis.configure({ apiKey: cle(), appUserID: utilisateur });
    configure = true;
    return;
  }
  if (utilisateur) await depuis.logIn(utilisateur);
}

/** Prix en monnaie de l'App Store, tels qu'Apple les affiche (jamais ceux de la base : la règle impose les prix Apple). */
export async function lirePrixApple(depuis: SdkAchats = sdk()): Promise<PrixApple> {
  const offres = await depuis.getOfferings();
  const resultat: PrixApple = {};
  for (const p of offres.current?.availablePackages ?? []) {
    if (p.identifier === 'week' || p.identifier === 'month' || p.identifier === 'contest') resultat[p.identifier] = { prix: p.product.priceString, paquet: p };
  }
  return resultat;
}

/** Lance la feuille d'achat Apple. L'annulation par l'utilisateur n'est pas une erreur. */
export async function acheterPass(paquet: Package, depuis: SdkAchats = sdk()): Promise<ResultatAchat> {
  try {
    await depuis.purchasePackage(paquet);
    return 'achete';
  } catch (e) {
    if ((e as { userCancelled?: boolean } | null)?.userCancelled) return 'annule';
    throw e;
  }
}

/** « Restaurer mes achats » : obligatoire pour les achats restaurables (règle 3.1.1). */
export async function restaurerAchats(depuis: SdkAchats = sdk()): Promise<void> {
  await depuis.restorePurchases();
}

/** Déconnexion du compte : les achats suivent le compte suivant, pas l'appareil. */
export async function oublierUtilisateurAchats(depuis: SdkAchats = sdk()): Promise<void> {
  if (!configure) return;
  await depuis.logOut();
}

/** Attend que le webhook ait créé l'accès côté serveur (délai de quelques secondes après l'achat). */
export async function attendreAcces<T>(lire: () => Promise<T | null>, essais = 6, pauseMs = 1500): Promise<T | null> {
  for (let i = 0; i < essais; i++) {
    const acces = await lire().catch(() => null);
    if (acces) return acces;
    await new Promise((r) => setTimeout(r, pauseMs));
  }
  return null;
}
