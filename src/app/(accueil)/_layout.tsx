import { Stack } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';

// Parcours d'arrivée (parcours A) : bienvenue, classe et pays, premier résultat. Aucun compte demandé.
export default function LayoutAccueil() {
  const { theme } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.fond.app } }} />;
}
