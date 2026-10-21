import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import type { NotionLiee, QuestionServie } from '@/services/certification/types';
import { useTheme } from '@/theme/ThemeProvider';
import { corrige as corrigeCouleurs, espace, typo } from '@/theme/theme';

import { Carte } from '../Carte';
import { Etiquette } from '../Etiquette';

const LETTRES = ['A', 'B', 'C', 'D'];

type Props = {
  question: QuestionServie;
  /** Libellé de l'étiquette jaune en tête de carte (« Explication », « Corrigé »). */
  badge: string;
  juste: boolean;
  /** Option choisie ; `null` = question passée (la ligne « Ta réponse » n'apparaît pas). */
  choix: number | null;
  bonne: number;
  notion: NotionLiee | null;
  piege: string | null;
};

/** Carte de correction en grille (v28) : libellé à gauche, valeur à droite, juste ou faux écrit, jamais la couleur seule. */
export function CarteCorrection({ question, badge, juste, choix, bonne, notion, piege }: Props) {
  const { t } = useTraduction();
  const { sombre } = useTheme();
  const couleurs = sombre ? corrigeCouleurs.dark : corrigeCouleurs.light;
  const libelleOption = (i: number) => `${LETTRES[i] ?? String(i + 1)} · ${question.options[i] ?? ''}`;
  return (
    <Carte style={{ backgroundColor: couleurs.fond, gap: espace[3] }}>
      <View style={styles.enteteGrille}>
        <Etiquette texte={badge} jaune />
        <Etiquette texte={juste ? t('certification.exercice.grilleJuste') : t('certification.exercice.grilleFaux')} />
      </View>
      <LigneGrille libelle={t('certification.exercice.grilleBonne')} valeur={libelleOption(bonne)} couleur={couleurs.texte} />
      {!juste && choix !== null ? <LigneGrille libelle={t('certification.exercice.grilleTienne')} valeur={libelleOption(choix)} couleur={couleurs.texte} /> : null}
      {notion ? <LigneGrille libelle={t('certification.exercice.grilleNotion')} valeur={notion.title} couleur={couleurs.texte} /> : null}
      {piege ? <LigneGrille libelle={t('certification.exercice.grillePiege')} valeur={piege} couleur={couleurs.texte} /> : null}
    </Carte>
  );
}

/** Une ligne de la grille de correction : libellé en colonne fixe, valeur à droite. */
function LigneGrille({ libelle, valeur, couleur }: { libelle: string; valeur: string; couleur: string }) {
  return (
    <View style={styles.ligneGrille}>
      <Text style={[typo.etiquette, styles.libelleGrille, { color: couleur }]}>{libelle}</Text>
      <Text style={[typo.petit, styles.valeurGrille, { color: couleur }]}>{valeur}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  enteteGrille: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: espace[2] },
  ligneGrille: { flexDirection: 'row', alignItems: 'flex-start', gap: espace[3] },
  libelleGrille: { width: 96 },
  valeurGrille: { flex: 1 },
});
