import { Stack } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';

// Parcours d'arrivée du profil TOEIC (A2 à A8) : aucun compte demandé.
export default function LayoutCertification() {
  const { theme } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.fond.app } }} />;
}
