import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * H2 Paramètres › « Télécharger en Wi-Fi seulement » : économise les données mobiles. Désactivé par défaut.
 * Lu par les téléchargements (documents, missions hors ligne) avant de lancer un gros fichier.
 */
export const CLE_WIFI_SEULEMENT = 'donnees.wifiSeulement';

export async function lireWifiSeulement(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CLE_WIFI_SEULEMENT)) === '1';
  } catch {
    return false;
  }
}

export async function definirWifiSeulement(valeur: boolean): Promise<void> {
  await AsyncStorage.setItem(CLE_WIFI_SEULEMENT, valeur ? '1' : '0').catch(() => {});
}
