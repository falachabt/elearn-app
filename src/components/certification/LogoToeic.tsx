import { Image } from 'expo-image';
import { Award, type LucideIcon } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';

/**
 * Logo officiel du TOEIC, affiché partout où le TOEIC apparaît. Le fichier n'est pas encore fourni : tant que
 * `LOGO_TOEIC` vaut `null`, le composant garde l'icône générique. Pour brancher le logo, Benny dépose le fichier
 * `assets/images/logo-toeic.png` (fond transparent, version claire) et `logo-toeic-sombre.png` (version sombre), puis
 * on remplace `null` par les deux `require`.
 */
const LOGO_TOEIC: { clair: number; sombre: number } | null = null;

/** Repli : icône générique tant que le logo n'est pas livré. */
export function LogoToeic({ taille = 20, Repli = Award }: { taille?: number; Repli?: LucideIcon }) {
  const { theme, sombre } = useTheme();
  if (!LOGO_TOEIC) return <Repli size={taille} color={theme.texte.principal} strokeWidth={2} />;
  return <Image source={sombre ? LOGO_TOEIC.sombre : LOGO_TOEIC.clair} style={{ width: taille, height: taille }} contentFit="contain" accessibilityIgnoresInvertColors />;
}
