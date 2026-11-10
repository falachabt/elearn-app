import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tour de première fois du diagnostic (issue #123) : deux moments indépendants, présentés une seule fois par
 * appareil — le rappel au premier groupe audio, la feuille à la première partie 7 multi-documents. Même patron
 * que les visites des annales (`annales.visite.<ecran>.vue` dans `travailSujet.ts`) : par appareil, jamais
 * rattaché au compte, et ce n'est pas une clé de contenu (aucune expiration hors ligne).
 */
export type MomentTourDiagnostic = 'audio' | 'partie7';

const cleTour = (moment: MomentTourDiagnostic) => `cert.tourDiagnostic.${moment}.vue`;

/** Vrai quand le moment a déjà été présenté sur cet appareil. Une lecture qui échoue compte comme « déjà vu » : jamais bloquant. */
export async function tourDiagnosticDejaVu(moment: MomentTourDiagnostic): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(cleTour(moment))) === '1';
  } catch {
    return true;
  }
}

/** Pose le drapeau du moment : il s'écrit à la fermeture de sa feuille, pas à son ouverture. */
export const marquerTourDiagnosticVu = (moment: MomentTourDiagnostic) => AsyncStorage.setItem(cleTour(moment), '1').catch(() => {});
