import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { obtenirReglages } from '@/services/certification/etat';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Carte } from '../Carte';
import { Etiquette } from '../Etiquette';
import { EtiquetteSection } from './ui';

type Props = {
  /** Écran A5 (arrivée, plein écran) : ajoute « Ce que ça donne ». L'onglet S7 le retire pour tenir sous le bouton. */
  complet?: boolean;
};

/**
 * Ce que contient le diagnostic, avant le premier passage (maquettes TOEIC-A5 et TOEIC-S7, version 15).
 * Le nombre de questions vient de la configuration du serveur, jamais d'une valeur écrite ici.
 */
export function PreparationDiagnostic({ complet = true }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [questions, setQuestions] = useState<number | null>(null);

  useEffect(() => {
    let actif = true;
    obtenirReglages()
      .then((r) => actif && setQuestions(r.scoreMinReponses))
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, []);

  return (
    <View style={styles.groupe}>
      <Carte>
        <View style={styles.groupe}>
          <Etiquette texte={t('certification.arrivee.badge')} jaune />
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>
            {t('certification.arrivee.titre')}
          </Text>
          <View style={styles.reperes}>
            {questions !== null ? <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{t('certification.arrivee.repereQuestions', { n: questions })}</Text> : null}
            <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{t('certification.arrivee.repereDuree')}</Text>
            <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{t('certification.arrivee.repereGratuit')}</Text>
          </View>
        </View>
      </Carte>
      <EtiquetteSection texte={t('certification.arrivee.contientTitre')} />
      <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.arrivee.contientEcoute')}</Text>
      <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.arrivee.contientLecture')}</Text>
      {complet ? (
        <>
          <EtiquetteSection texte={t('certification.arrivee.donneTitre')} />
          <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.arrivee.donneTexte')}</Text>
        </>
      ) : null}
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.arrivee.regle')}</Text>
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.arrivee.sansCompte')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[3] },
  reperes: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[2] },
});
