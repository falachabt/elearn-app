import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banniere } from '@/components/Banniere';
import { Bouton } from '@/components/Bouton';
import { Carte } from '@/components/Carte';
import { Champ } from '@/components/Champ';
import { Etiquette } from '@/components/Etiquette';
import { OptionReponse } from '@/components/OptionReponse';
import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

// Écran provisoire : vitrine des composants, remplacée par le parcours « premier lancement » (phase 2).
export default function Accueil() {
  const { theme } = useTheme();
  const { t } = useTraduction();
  const { top } = useSafeAreaInsets();
  const [choix, setChoix] = useState<string | null>(null);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.fond.app }}
      contentContainerStyle={[styles.contenu, { paddingTop: top + espace[7], paddingBottom: espace[7] }]}
    >
      <Etiquette texte={t('accueil.etiquette')} jaune />
      <Text style={[typo.affiche, { color: theme.texte.principal }]}>{t('accueil.titre')}</Text>
      <Text style={[typo.texteGrand, { color: theme.texte.secondaire }]}>{t('accueil.accroche')}</Text>

      <Carte>
        <View style={styles.groupe}>
          <Text style={[typo.h3, { color: theme.texte.principal }]}>{t('accueil.exercice')}</Text>
          {['2', '3', '4'].map((valeur, i) => (
            <OptionReponse
              key={valeur}
              lettre={'ABC'[i]}
              texte={valeur}
              etat={choix === valeur ? (valeur === '3' ? 'bonne' : 'fausse') : 'neutre'}
              onPress={() => setChoix(valeur)}
            />
          ))}
        </View>
      </Carte>

      <Banniere ton="info" titre={t('accueil.astuceTitre')} texte={t('accueil.astuceTexte')} />
      <Champ libelle={t('accueil.champMobileMoney')} placeholder="6 12 34 56 78" keyboardType="phone-pad" />
      <Bouton libelle={t('actions.commencer')} onPress={() => setChoix(null)} />
      <Bouton libelle={t('actions.plusTard')} variante="texte" onPress={() => setChoix(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenu: { paddingHorizontal: espace[6], gap: espace[6] },
  groupe: { gap: espace[4] },
});
