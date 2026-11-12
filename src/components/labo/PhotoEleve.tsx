import { Camera } from 'lucide-react-native';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

/** Vraie photo de l'élève dans le fil du labo (choisie à la caméra ou dans la galerie), dans la carte du bloc photo. */
export function PhotoEleve({ uri }: { uri: string }) {
  const { theme } = useTheme();
  const { t } = useTraduction();
  return (
    <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
      <Image source={{ uri }} style={styles.image} resizeMode="cover" accessibilityIgnoresInvertColors />
      <View style={styles.legende}>
        <Camera size={14} strokeWidth={2.25} color={theme.texte.secondaire} />
        <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('labo.photoEnvoyee')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderWidth: bord.normal, borderRadius: rayon.m, padding: espace[2], gap: espace[2], width: 264 },
  image: { width: '100%', height: 150, borderRadius: rayon.s },
  legende: { flexDirection: 'row', alignItems: 'center', gap: espace[2], paddingHorizontal: espace[2] },
});
