import { router } from 'expo-router';
import { Award, CalendarRange, Clock, Lightbulb, Target, Wallet } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lirePlan } from '@/services/certification/etat';
import { afficherJour } from '@/services/certification/format';
import { espace } from '@/theme/theme';

import { Ecran } from '../Ecran';
import { EnteteToeic, LigneChoix } from './ui';
import { useChargement } from './useChargement';

/** N2 · Moi, profil TOEIC : objectif, temps par jour, crédits et Pass, ma semaine, certification, réglages. */
export function MoiToeic() {
  const { t } = useTraduction();
  const { etat } = useChargement(lirePlan);
  const plan = etat.phase === 'ok' ? etat.valeur : null;
  const aller = (chemin: object | string) => router.push(chemin as never);
  const aideObjectif = plan?.objectif ? (plan.dateTest ? t('certification.moiToeic.objectifAide', { score: plan.objectif, date: afficherJour(plan.dateTest) }) : t('certification.moiToeic.objectifAideSans', { score: plan.objectif })) : t('certification.moiToeic.objectifVide');

  return (
    <Ecran insetBas={false} entete={<EnteteToeic titre={t('certification.moiToeic.entete')} />}>
      <View style={styles.groupe}>
        <LigneChoix icone={Target} titre={t('certification.moiToeic.objectif')} aide={aideObjectif} onPress={() => aller({ pathname: '/certification/objectif', params: { modifier: '1' } })} />
        <LigneChoix icone={Clock} titre={t('certification.moiToeic.temps')} aide={plan?.minutes ? t('certification.moiToeic.tempsAide', { n: plan.minutes }) : undefined} onPress={() => aller({ pathname: '/certification/temps', params: { modifier: '1' } })} />
        <LigneChoix icone={Wallet} titre={t('certification.moiToeic.credits')} onPress={() => aller({ pathname: '/offres', params: { declencheur: 'moi' } })} />
        <LigneChoix icone={CalendarRange} titre={t('certification.moiToeic.semaine')} aide={t('certification.moiToeic.semaineAide')} onPress={() => aller('/ma-semaine')} />
        <LigneChoix icone={Award} titre={t('certification.moiToeic.certification')} aide={t('certification.moiToeic.certificationAide', { examen: 'TOEIC' })} onPress={() => aller('/certification')} />
        <LigneChoix icone={Lightbulb} titre={t('certification.moiToeic.reglages')} aide={t('certification.moiToeic.reglagesAide')} onPress={() => aller('/parametres')} />
      </View>
    </Ecran>
  );
}

const styles = StyleSheet.create({ groupe: { gap: espace[3] } });
