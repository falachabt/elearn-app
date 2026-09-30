import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Bouton } from '@/components/Bouton';
import { Carte } from '@/components/Carte';
import { Ecran } from '@/components/Ecran';
import { Interrupteur } from '@/components/Interrupteur';
import { useFeedback } from '@/components/useFeedback';
import { useTraduction } from '@/i18n/useTraduction';
import { definirPreference, moments } from '@/services/retours';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

/** Paramètres › Sons et vibrations (M16-02) : trois interrupteurs séparés et un aperçu de chaque retour. */
export default function Parametres() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { preferences, declencher, reduit } = useFeedback();

  return (
    <Ecran>
      <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('parametres.titre')}</Text>
      <Carte>
        <View style={styles.groupe}>
          <Interrupteur libelle={t('parametres.sons')} aide={t('parametres.sonsAide')} valeur={preferences.sons} onChange={(v) => definirPreference('sons', v)} />
          <Interrupteur libelle={t('parametres.vibrations')} aide={t('parametres.vibrationsAide')} valeur={preferences.vibrations} onChange={(v) => definirPreference('vibrations', v)} />
          <Interrupteur
            libelle={t('parametres.animationsReduites')}
            aide={t('parametres.animationsReduitesAide')}
            valeur={reduit}
            onChange={(v) => definirPreference('animationsReduites', v)}
          />
        </View>
      </Carte>
      <View style={styles.groupe}>
        <Text style={[typo.h3, { color: theme.texte.principal }]}>{t('parametres.apercuTitre')}</Text>
        <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('parametres.apercuAide')}</Text>
        <View style={styles.moments}>
          {moments.map((m) => (
            <View key={m} style={styles.moment}>
              <Bouton petit variante="secondaire" libelle={t(`parametres.moments.${m}`)} onPress={() => declencher(m, { apercu: true })} />
            </View>
          ))}
        </View>
      </View>
      <Bouton variante="texte" libelle={t('parametres.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[5] },
  moments: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[4] },
  moment: { minWidth: 140 },
});
