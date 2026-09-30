import { Image, StyleSheet } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';

const symbole = require('../../assets/images/logo-symbole.png');
const horizontalNoir = require('../../assets/images/logo-horizontal-noir.png');
const horizontalBlanc = require('../../assets/images/logo-horizontal-blanc.png');

// Tailles d'origine des fichiers (proportions à respecter : jamais déformer le logo).
const RATIO_HORIZONTAL = 893 / 333;

type Props = {
  /** `symbole` : la tuile seule. `horizontal` : symbole + « Elearn PREPA ». */
  variante?: 'symbole' | 'horizontal';
  /** Hauteur en px (24 minimum selon la charte). */
  hauteur?: number;
  /** Force une version ; par défaut, suit le thème (texte noir en clair, blanc en sombre). */
  mode?: 'clair' | 'sombre';
};

/** Logo Elearn Prepa. Le symbole est identique dans les deux thèmes ; le texte de la version horizontale s'inverse. */
export function Logo({ variante = 'horizontal', hauteur = 56, mode }: Props) {
  const { sombre } = useTheme();
  const { t } = useTraduction();
  const h = Math.max(hauteur, 24);
  const surSombre = mode ? mode === 'sombre' : sombre;
  const source = variante === 'symbole' ? symbole : surSombre ? horizontalBlanc : horizontalNoir;
  const largeur = variante === 'symbole' ? h : Math.round(h * RATIO_HORIZONTAL);
  return (
    <Image
      source={source}
      style={[styles.image, { width: largeur, height: h }]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel={t('accueil.logoLibelle')}
    />
  );
}

const styles = StyleSheet.create({ image: { alignSelf: 'flex-start' } });
