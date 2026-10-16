import { router, useLocalSearchParams } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { EnteteToeic } from './ui';

/** T6 · Test complet (et demi-test) : annoncé « Bientôt ». Le bouton de lancement reste grisé, aucun coût n'est inventé. */
export function TestBientot() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  return (
    <Ecran
      entete={<EnteteToeic titre={kind === 'half' ? t('certification.tests.demi') : t('certification.tests.bientotEntete')} onRetour={() => router.back()} />}
      pied={
        <View style={styles.pied}>
          <Bouton libelle={t('certification.tests.bientotLancer')} desactive onPress={() => {}} />
          <Bouton variante="texte" libelle={t('certification.tests.bientotMini')} onPress={() => router.replace('/certification/mini' as never)} />
        </View>
      }
    >
      <Carte style={{ gap: espace[2] }}>
        <View style={styles.titre}>
          <Clock size={20} color={theme.texte.principal} strokeWidth={2} />
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('certification.tests.bientotTitre')}</Text>
        </View>
        <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('certification.tests.bientotSousTitre')}</Text>
        <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.tests.bientotTexte')}</Text>
      </Carte>
    </Ecran>
  );
}

const styles = StyleSheet.create({ pied: { gap: espace[2] }, titre: { flexDirection: 'row', alignItems: 'center', gap: espace[2] } });
