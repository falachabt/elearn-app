import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { Etiquette } from '../Etiquette';
import { EnteteToeic } from './ui';

type Props = {
  partie: number;
  /** Nombre de questions de la partie dans le diagnostic. */
  questions: number;
  onCommencer: () => void;
  onRetour: () => void;
};

/** D-P1, D-P3 : consignes affichées avant chaque partie du diagnostic, avec « Commencer la partie N ». */
export function ConsignesPartie({ partie, questions, onCommencer, onRetour }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [envoi, setEnvoi] = useState(false);
  const cle = partie as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  return (
    <Ecran
      entete={<EnteteToeic titre={t('certification.consignes.entete', { n: partie })} onRetour={onRetour} />}
      pied={
        <View style={styles.pied}>
          <Bouton libelle={t('certification.consignes.commencer', { n: partie })} desactive={envoi} onPress={() => (setEnvoi(true), onCommencer())} retour />
        </View>
      }
    >
      <Etiquette texte={t('certification.diagnostic.partie', { n: partie })} />
      <View style={styles.groupe}>
        <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>
          {t(`certification.consignes.partie${cle}.titre` as 'certification.consignes.partie1.titre')}
        </Text>
        <Text style={[typo.texte, { color: theme.texte.principal }]}>
          {t(`certification.consignes.partie${cle}.texte` as 'certification.consignes.partie1.texte')}
        </Text>
        <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('certification.consignes.nombre', { n: questions })}</Text>
        <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('certification.consignes.retour')}</Text>
      </View>
    </Ecran>
  );
}

const styles = StyleSheet.create({ groupe: { gap: espace[3] }, pied: { gap: espace[2] } });
