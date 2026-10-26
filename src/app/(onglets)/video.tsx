import { LecteurVideo } from '@/components/reviser/LecteurVideo';

/**
 * Lecteur vidéo d'un cours. La route vit dans le groupe (onglets) : la barre d'onglets reste visible
 * (demande de Benny le 26/10/2026) et le header de l'écran porte le retour vers la page du cours.
 * Attention : expo-router/ui n'enregistre que les routes déclarées en TabTrigger — le layout déclare
 * donc un déclencheur « video » invisible (aucun bouton dans la barre), sinon /video est injoignable.
 */
export default function EcranLecteurVideo() {
  return <LecteurVideo />;
}
