import { LecteurVideo } from '@/components/reviser/LecteurVideo';

/**
 * Lecteur vidéo d'un cours. La route vit dans le groupe (onglets), SANS déclencheur dans la barre :
 * patron expo-router/ui pour les écrans de détail — la barre d'onglets reste visible (demande de Benny
 * le 26/10/2026), le header de l'écran porte le retour vers la page du cours.
 */
export default function EcranLecteurVideo() {
  return <LecteurVideo />;
}
