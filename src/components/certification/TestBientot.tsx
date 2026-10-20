import { router, useLocalSearchParams } from 'expo-router';
import { Clock, Layers } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTextesCredits } from '@/components/credits/textes';
import { useTraduction } from '@/i18n/useTraduction';
import { useCredits } from '@/session/CreditsProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { EnteteToeic, LigneChoix } from './ui';

/** T6 · Test complet (et demi-test) : annoncé « Bientôt », fiche de la maquette. Le bouton reste grisé ; aucun coût n'est inventé, il vient du serveur. */
export function TestBientot() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const { couts } = useCredits();
  const { cout } = useTextesCredits();
  const coutMixte = couts.cert_mock_mini_twenty;
  return (
    <Ecran
      entete={<EnteteToeic titre={kind === 'half' ? t('certification.tests.demi') : t('certification.tests.bientotEntete')} onRetour={() => router.back()} />}
      pied={
        <View style={styles.pied}>
          <Bouton libelle={t('certification.tests.bientotLancer')} desactive onPress={() => {}} />
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
      {kind === 'half' ? null : (
        <LigneChoix
          icone={Layers}
          titre={t('certification.tests.bientotMixteTitre')}
          aide={coutMixte === undefined ? t('certification.tests.bientotMixteAide') : t('certification.tests.bientotMixteAideCout', { cout: cout(coutMixte) })}
          onPress={() => router.push('/certification/mini?mode=mixte' as never)}
        />
      )}
    </Ecran>
  );
}

const styles = StyleSheet.create({ pied: { gap: espace[2] }, titre: { flexDirection: 'row', alignItems: 'center', gap: espace[2] } });
