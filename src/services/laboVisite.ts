import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Visite guidée du labo « chat interactif » : drapeau « déjà vue » persisté sur l'appareil, comme les visites
 * des écrans de correction du travail (`annales.visite.*`). La visite ne se lance qu'à la première ouverture.
 */

const CLE_VISITE = 'labo.chat.visite.vue';

export async function visiteLaboDejaVue(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CLE_VISITE)) === '1';
  } catch {
    return false;
  }
}

export const marquerVisiteLaboVue = () => AsyncStorage.setItem(CLE_VISITE, '1').catch(() => {});
