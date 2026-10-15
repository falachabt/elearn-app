import { router } from 'expo-router';
import { BookOpen, CalendarDays, NotebookPen } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { lireDiagnostic, obtenirReglages } from '@/services/certification/etat';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { Etiquette } from '../Etiquette';
import { EncadrePointille, EnteteToeic, LigneChoix } from './ui';

/** A5 · Arrivée sur le profil TOEIC, avant le diagnostic : aucun chiffre de performance (profil neuf). */
export function ArriveeToeic() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [questions, setQuestions] = useState<number | null>(null);
  const [reprise, setReprise] = useState(false);

  useEffect(() => {
    let actif = true;
    obtenirReglages()
      .then((r) => actif && setQuestions(r.scoreMinReponses))
      .catch(() => {});
    lireDiagnostic().then((d) => actif && setReprise(!!d && !d.fin));
    return () => {
      actif = false;
    };
  }, []);

  const commencer = () => {
    suivre('cert_diagnostic_started', {});
    router.push('/certification/diagnostic');
  };

  return (
    <Ecran entete={<EnteteToeic titre={t('certification.arrivee.entete')} />} pied={<Bouton libelle={t(reprise ? 'certification.arrivee.reprendre' : 'certification.arrivee.commencer')} onPress={commencer} retour />}>
      <Carte>
        <View style={styles.carte}>
          <Etiquette texte={t('certification.arrivee.badge')} jaune />
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('certification.arrivee.titre')}</Text>
          {questions !== null ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.arrivee.texte', { n: questions })}</Text> : null}
        </View>
      </Carte>
      <EncadrePointille texte={t('certification.arrivee.encadre')} />
      <LigneChoix icone={BookOpen} titre={t('certification.arrivee.cours')} aide={t('certification.arrivee.coursAide')} />
      <LigneChoix icone={NotebookPen} titre={t('certification.arrivee.carnet')} aide={t('certification.arrivee.carnetAide')} />
      <LigneChoix icone={CalendarDays} titre={t('certification.arrivee.seance')} aide={t('certification.arrivee.seanceAide')} />
    </Ecran>
  );
}

const styles = StyleSheet.create({ carte: { gap: espace[3] } });
