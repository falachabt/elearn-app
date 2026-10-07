import AsyncStorage from '@react-native-async-storage/async-storage';

export const CLE_BANDEAU = 'web.bandeauApplication';
export const DELAI_BANDEAU_JOURS = 7;
const JOUR_MS = 24 * 60 * 60 * 1000;

export type PlateformeWeb = 'android' | 'ios' | 'bureau';
export type Magasin = 'play' | 'appstore';

/** Android voit Google Play, iPhone et iPad l'App Store, un ordinateur les deux. */
export function plateformeWeb(agent: string, pointsDeContact = 0): PlateformeWeb {
  if (/android/i.test(agent)) return 'android';
  // iPadOS se présente comme un Mac : on le reconnaît à l'écran tactile.
  if (/iphone|ipad|ipod/i.test(agent) || (/macintosh/i.test(agent) && pointsDeContact > 1)) return 'ios';
  return 'bureau';
}

/** Magasins proposés : ceux de la plateforme dont le lien est configuré. */
export function magasinsAffiches(plateforme: PlateformeWeb, liens: { play: string | null; appstore: string | null }): { magasin: Magasin; lien: string }[] {
  const voulus: Magasin[] = plateforme === 'android' ? ['play'] : plateforme === 'ios' ? ['appstore'] : ['play', 'appstore'];
  return voulus.flatMap((magasin) => (liens[magasin] ? [{ magasin, lien: liens[magasin] as string }] : []));
}

/** Écrans plein cadre où le bandeau ne s'affiche jamais : appareil photo, épreuve chronométrée, paiement. */
export function ecranSansBandeau(chemin: string): boolean {
  return /^\/(photo|offres\/payer|offres\/parent|paiements|annales\/sujet)(\/|$)/.test(chemin);
}

export async function bandeauFermeRecemment(maintenant: Date = new Date()): Promise<boolean> {
  try {
    const brut = await AsyncStorage.getItem(CLE_BANDEAU);
    if (!brut) return false;
    const ecoule = (maintenant.getTime() - new Date(brut).getTime()) / JOUR_MS;
    return Number.isFinite(ecoule) && ecoule < DELAI_BANDEAU_JOURS;
  } catch {
    // Sans stockage, il s'affiche à chaque visite.
    return false;
  }
}

export async function fermerBandeau(maintenant: Date = new Date()): Promise<void> {
  try {
    await AsyncStorage.setItem(CLE_BANDEAU, maintenant.toISOString());
  } catch {
    // Stockage indisponible : le bandeau se fermera quand même pour cette visite.
  }
}
