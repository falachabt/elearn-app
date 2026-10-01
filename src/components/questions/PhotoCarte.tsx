import { Maximize2 } from 'lucide-react-native';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';

/** Photo d'une question ou d'une réponse (G3d) : entière (contain) sur 160 px au plus, étiquette « Agrandir », appui = visionneuse. */
export function PhotoCarte({ uri, onAgrandir }: { uri: string; onAgrandir: (uri: string) => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  return (
    <Appui accessibilityRole="imagebutton" accessibilityLabel={t('questions.agrandirPhoto')} onPress={() => onAgrandir(uri)} decalage={0} rayon={8}>
      <View style={[styles.cadre, { borderColor: theme.bord.fort, backgroundColor: theme.fond.creux }]}>
        <Image source={{ uri }} style={styles.image} resizeMode="contain" accessibilityIgnoresInvertColors />
        <View style={[styles.etiquette, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          <Maximize2 size={12} strokeWidth={2.25} color={theme.texte.principal} />
          <Text style={[typo.boutonPetit, { color: theme.texte.principal }]}>{t('questions.agrandir')}</Text>
        </View>
      </View>
    </Appui>
  );
}

const styles = StyleSheet.create({
  cadre: { height: 160, borderWidth: bord.normal, borderRadius: 8, overflow: 'hidden' },
  etiquette: { position: 'absolute', right: espace[3], bottom: espace[3], flexDirection: 'row', alignItems: 'center', gap: espace[2], borderWidth: bord.fin, borderRadius: rayon.pilule, paddingHorizontal: espace[3], paddingVertical: espace[1] },
  image: { width: '100%', height: '100%' },
});
