import { Check, Minus, X } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import type { StatutQuestion } from '@/services/certification/bilanMini';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { GrilleEgale } from './ui';

type Props = {
  statuts: StatutQuestion[];
  /** Question affichée (revue) : sa case reçoit le contour épais. */
  actif?: number;
  /** Présent : chaque case est un bouton qui ouvre la question (revue). */
  onChoisir?: (i: number) => void;
};

/**
 * Grille des questions d'un test (v28) : une case par question, numérotée. Juste, faux et sans réponse portent une icône
 * et un libellé, jamais la seule couleur.
 */
export function GrilleQuestions({ statuts, actif, onChoisir }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const cases = statuts.map((statut, i) => {
    const libelle = t(`certification.examen.grille.${statut}`, { n: i + 1 });
    const fond = statut === 'juste' ? theme.etat.succes : statut === 'faux' ? theme.etat.erreur : theme.fond.surface;
    const Icone = statut === 'juste' ? Check : statut === 'faux' ? X : Minus;
    const contenu = (
      <View accessibilityLabel={libelle} style={[styles.case, { backgroundColor: fond, borderColor: theme.bord.fort, borderWidth: actif === i ? bord.epais : bord.normal }]}>
        <Icone size={12} color={theme.texte.surCouleur} strokeWidth={2.5} />
        <Text style={[typo.legende, { color: statut === 'sans' ? theme.texte.principal : theme.texte.surCouleur }]}>{i + 1}</Text>
      </View>
    );
    return onChoisir ? (
      <Appui key={i} accessibilityRole="button" accessibilityLabel={libelle} accessibilityState={{ selected: actif === i }} onPress={() => onChoisir(i)} decalage={0} rayon={rayon.s}>
        {contenu}
      </Appui>
    ) : (
      <View key={i}>{contenu}</View>
    );
  });
  return <GrilleEgale colonnes={10} enfants={cases} />;
}

const styles = StyleSheet.create({
  case: { minHeight: cibleMin - 8, alignItems: 'center', justifyContent: 'center', gap: espace[1], borderRadius: rayon.s },
});
