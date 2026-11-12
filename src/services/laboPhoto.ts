import * as ImagePicker from 'expo-image-picker';

import { preparerImage } from './photo';

/**
 * Sélection d'une vraie photo pour le labo « chat interactif » : même flux que l'onglet photo et l'écran
 * « Poser une question » (expo-image-picker, caméra ou bibliothèque, permission demandée par le système).
 * La photo retenue est préparée comme pour la correction photo (JPEG réduit, base64) : l'écran l'affiche
 * telle quelle et l'envoie au moteur « conversation » en mode mixte.
 */

export type SourcePhoto = 'camera' | 'bibliotheque';

export type PhotoChoisie = {
  /** Adresse locale de l'image préparée (aperçu dans le fil et le composeur). */
  uri: string;
  /** JPEG en base64, sans préfixe data: — la forme qu'attend la fonction « conversation ». */
  base64: string;
};

export type IssueChoixPhoto =
  | { type: 'photo'; photo: PhotoChoisie }
  | { type: 'annule' }
  | { type: 'permission' }
  | { type: 'erreur' };

/** Cadre entier de l'image (pas de recadrage dans le labo). */
const CADRE_ENTIER = { x: 0, y: 0, largeur: 1, hauteur: 1 };

export async function choisirPhotoLabo(source: SourcePhoto): Promise<IssueChoixPhoto> {
  try {
    const permission =
      source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return { type: 'permission' };
    const r =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: false });
    if (r.canceled) return { type: 'annule' };
    const a = r.assets[0];
    if (!a?.uri) return { type: 'erreur' };
    const preparee = await preparerImage(a.uri, CADRE_ENTIER, a.width ?? 1024, a.height ?? 1024);
    return { type: 'photo', photo: { uri: preparee.uri, base64: preparee.base64 } };
  } catch {
    return { type: 'erreur' };
  }
}
