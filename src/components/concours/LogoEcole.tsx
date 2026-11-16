import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, typo } from '@/theme/theme';

/** Logo de l'école quand la base en a un, sinon ses initiales sur fond crème. */
export function LogoEcole({ concours, taille = 44 }: { concours: { sigle: string; logo?: string | null }; taille?: number }) {
  const { theme } = useTheme();
  const { t } = useTraduction();
  const [erreur, setErreur] = useState(false);
  const cadre = { width: taille, height: taille, borderRadius: taille / 2, borderColor: theme.bord.fort };
  if (concours.logo && !erreur) {
    return (
      <View style={[styles.logo, cadre, { backgroundColor: '#FFFFFF' }]}>
        <Image
          source={{ uri: concours.logo }}
          style={{ width: taille - 8, height: taille - 8 }}
          contentFit="contain"
          accessibilityLabel={t('concours.initialesLogo', { ecole: concours.sigle })}
          onError={() => setErreur(true)}
        />
      </View>
    );
  }
  return (
    <View style={[styles.logo, cadre, { backgroundColor: theme.accent.soleilTresDoux }]}>
      <Text style={[typo.legende, { color: theme.texte.surCouleur }]}>{concours.sigle.slice(0, 4).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
