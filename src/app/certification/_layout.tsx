import { Redirect, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useProfilCertification } from '@/components/certification/useProfilCertification';
import { ecouterDrapeaux } from '@/services/analytics';
import { useTheme } from '@/theme/ThemeProvider';

/** Délai laissé aux drapeaux PostHog pour arriver avant de conclure qu'ils sont fermés (cas d'une ouverture à froid). */
const DELAI_DRAPEAUX_MS = 3000;

/**
 * Parcours d'arrivée du profil TOEIC (A2 à A8) : aucun compte demandé. Tout l'arbre est derrière le drapeau
 * `cert_profile_enabled` : un lien direct vers une route certification renvoie à l'accueil quand le drapeau est fermé.
 * Tant que PostHog n'a pas répondu, l'écran reste vide plutôt que de rediriger un élève de France au démarrage.
 */
export default function LayoutCertification() {
  const { theme } = useTheme();
  const ouvert = useProfilCertification();
  const drapeauxCharges = useDrapeauxCharges();
  if (ouvert) return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.fond.app } }} />;
  if (!drapeauxCharges) return <View style={[styles.vide, { backgroundColor: theme.fond.app }]} />;
  return <Redirect href="/" />;
}

function useDrapeauxCharges(): boolean {
  const [charges, setCharges] = useState(false);
  useEffect(() => {
    const delai = setTimeout(() => setCharges(true), DELAI_DRAPEAUX_MS);
    const arret = ecouterDrapeaux(() => setCharges(true));
    return () => {
      clearTimeout(delai);
      arret();
    };
  }, []);
  return charges;
}

const styles = StyleSheet.create({ vide: { flex: 1 } });
