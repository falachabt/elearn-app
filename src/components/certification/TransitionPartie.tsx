import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { Etiquette } from '../Etiquette';
import { EnteteToeic } from './ui';

type Props = {
  /** Partie qui vient de se terminer. */
  precedente: number;
  /** Partie qui commence. */
  partie: number;
  /** Nombre de questions de la partie qui commence. */
  questions: number;
  onCommencer: () => void;
};

/** T-P2 : page de transition entre deux parties d'un demi-test ou du test complet, avec la consigne de la partie suivante. */
export function TransitionPartie({ precedente, partie, questions, onCommencer }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const cle = partie as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  return (
    <Ecran
      entete={<EnteteToeic titre={t('certification.examen.transition', { precedente, n: partie })} />}
      pied={<Bouton libelle={t('certification.consignes.commencer', { n: partie })} onPress={onCommencer} retour />}
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
      </View>
    </Ecran>
  );
}

const styles = StyleSheet.create({ groupe: { gap: espace[3] } });
