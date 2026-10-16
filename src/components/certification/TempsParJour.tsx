import { router, useLocalSearchParams } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { ecrirePlan, lirePlan, obtenirReglages } from '@/services/certification/etat';
import type { Reglages } from '@/services/certification/reglages';
import { lireProfil } from '@/services/profil';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { EnteteToeic, LigneChoix } from './ui';

const AIDES: Record<number, 'm10' | 'm20' | 'm30'> = { 10: 'm10', 20: 'm20', 30: 'm30' };

/** A4 · Temps par jour : l'élève choisit lui-même (décision du 15 octobre). Les valeurs viennent de `cert_settings`. */
export function TempsParJour() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const modifier = useLocalSearchParams<{ modifier?: string }>().modifier === '1';
  const [r, setR] = useState<Reglages | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [exam, setExam] = useState('toeic');

  useEffect(() => {
    let actif = true;
    void (async () => {
      const [reglages, p, plan] = await Promise.all([obtenirReglages().catch(() => null), lireProfil(), lirePlan()]);
      if (!actif || !reglages) return;
      setR(reglages);
      setExam(p?.exam ?? 'toeic');
      setMinutes(plan?.minutes && reglages.seanceMinutesChoix.includes(plan.minutes) ? plan.minutes : reglages.seanceMinutesDefaut);
    })();
    return () => {
      actif = false;
    };
  }, []);

  const commencer = async () => {
    if (!minutes) return;
    await ecrirePlan({ exam, minutes });
    suivre('cert_daily_time_set', { minutes });
    if (modifier) router.back();
    // Objectif et temps sont enregistrés : les onglets TOEIC s'ouvrent, l'accueil affiche « Mon TOEIC avant diagnostic » (S7).
    else router.replace('/');
  };

  return (
    <Ecran
      entete={<EnteteToeic titre={t('certification.temps.entete')} onRetour={() => router.back()} />}
      pied={<Bouton libelle={modifier ? t('certification.enregistrer') : t('certification.temps.commencer')} desactive={!minutes} onPress={commencer} retour />}
    >
      {modifier ? null : <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.temps.etape')}</Text>}
      <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('certification.temps.titre')}</Text>
      <View style={styles.liste}>
        {(r?.seanceMinutesChoix ?? []).map((m) => {
          const cle = AIDES[m];
          // « Recommandé pour ton objectif » reste sur la durée par défaut tant qu'aucune règle de recommandation n'existe (E-06).
          const aide = m === r?.seanceMinutesDefaut ? t('certification.temps.m20') : cle ? t(`certification.temps.${cle}`) : undefined;
          return <LigneChoix key={m} icone={Clock} radio actif={minutes === m} titre={t('certification.temps.minutes', { n: m })} aide={aide} onPress={() => setMinutes(m)} />;
        })}
      </View>
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.temps.aide')}</Text>
    </Ecran>
  );
}

const styles = StyleSheet.create({ liste: { gap: espace[4] } });
