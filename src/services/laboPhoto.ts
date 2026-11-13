import * as ImagePicker from 'expo-image-picker';

import { preparerImage, type Cadre } from './photo';

/**
 * Sélection d'une vraie photo pour le labo « chat interactif » : même flux que l'onglet photo (expo-image-picker,
 * caméra ou bibliothèque, permission demandée par le système), puis **recadrage** par l'élève (même cadre que la
 * partie photo) et préparation comme pour la correction photo (JPEG réduit, base64). La sélection ne prépare
 * rien : elle renvoie la photo brute, l'écran la fait passer par l'étape de recadrage, puis `preparerPhotoLabo`
 * produit la photo finale — celle qui s'affiche dans le fil et qui part au moteur « conversation ».
 */

export type SourcePhoto = 'camera' | 'bibliotheque';

/** Nombre maximal de photos jointes à un même envoi (mode mixte) — la fonction serveur applique le même plafond. */
export const NB_MAX_PHOTOS = 4;

/** Photo brute sortie du sélecteur, avant recadrage : adresse locale et dimensions en pixels. */
export type PhotoBrute = {
  uri: string;
  largeur: number;
  hauteur: number;
};

/** Photo recadrée et préparée : aperçu local + JPEG en base64 (sans préfixe data:), la forme qu'attend le moteur. */
export type PhotoChoisie = {
  uri: string;
  base64: string;
};

export type IssueChoixPhoto =
  | { type: 'photo'; photo: PhotoBrute }
  | { type: 'annule' }
  | { type: 'permission' }
  | { type: 'erreur' };

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
    return { type: 'photo', photo: { uri: a.uri, largeur: a.width ?? 1024, hauteur: a.height ?? 1024 } };
  } catch {
    return { type: 'erreur' };
  }
}

/** Recadre la photo brute selon le cadre choisi par l'élève et la prépare pour l'envoi (même préparation que la correction photo). */
export async function preparerPhotoLabo(photo: PhotoBrute, cadre: Cadre): Promise<PhotoChoisie> {
  const preparee = await preparerImage(photo.uri, cadre, photo.largeur, photo.hauteur);
  return { uri: preparee.uri, base64: preparee.base64 };
}
