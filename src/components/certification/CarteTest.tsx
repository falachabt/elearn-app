import { Check, Circle, Clock, RotateCcw, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { GroupeColle } from '../liste/ListeCollee';
import { BarreProgression } from './ui';

export type StatutCarteTest = 'vide' | 'en_cours' | 'interrompu' | 'fait' | 'bientot';

export type ProprietesCarteTest = {
  icone: LucideIcon;
  /** Couleur du type de test (maquette v37) : vert, jaune, crème, corail, vert foncé, blanc. */
  couleur: string;
  titre: string;
  /** Détail discret sous le titre (nombre de questions, parties). */
  sous: string;
  /** Statut écrit en mots, avec son icône ; jamais la couleur seule. */
  statut: StatutCarteTest;
  libelleStatut: string;
  /** Meilleur score, en gros : « 8 sur 10 » (D-58). */
  score?: { valeur: number; max: number };
  /** Ligne discrète sous le score (tentatives, date). */
  detail?: string;
  /** Avancement « x faits sur n » avec sa barre (D-57). */
  progression?: { faits: number; total: number };
  /** Libellé du bouton d'action de la carte (maquette v34 : « Commencer », « Voir les tentatives »). */
  action?: string;
  onPress?: () => void;
  /** Ligne d'un bloc collé (`GroupeTests`) : sans contour propre, un trait fin au-dessus de toutes sauf la première. */
  collee?: boolean;
  premier?: boolean;
};

/** Plusieurs tests qui se suivent : un seul bloc collé (un contour, des traits fins). Les enfants sont des `CarteTest`. */
export function GroupeTests({ children }: { children: ReactNode }) {
  const lignes = Children.toArray(children).filter(isValidElement);
  return (
    <GroupeColle>
      {lignes.map((l, i) => cloneElement(l as ReactElement<{ collee?: boolean; premier?: boolean }>, { collee: true, premier: i === 0 }))}
    </GroupeColle>
  );
}

/**
 * Carte d'un test de l'onglet Tests (maquette v36 et v37, gabarit large) : une icône et une couleur par type, le statut en
 * mots, le score en gros, l'avancement « x faits sur n » et le détail en petit. Même gabarit pour mini-tests, demi-tests,
 * test complet (désactivé « Bientôt ») et corrigé.
 */
export function CarteTest({ icone: Icone, couleur, titre, sous, statut, libelleStatut, score, detail, progression, action, onPress, collee, premier }: ProprietesCarteTest) {
  const { theme } = useTheme();
  const { t } = useTraduction();
  const { Pastille, fond, texte } = pastilleDe(statut, theme);
  const actif = !!onPress && statut !== 'bientot';
  const faits = progression ? t(progression.faits <= 1 ? 'certification.tests.avancementUn' : 'certification.tests.avancement', { faits: progression.faits, total: progression.total }) : null;
  const contenu = (
    <View
      testID="carte-test"
      style={[
        styles.carte,
        collee
          ? [styles.collee, { backgroundColor: theme.fond.surface }, !premier && { borderTopWidth: bord.fin, borderTopColor: theme.bord.doux }]
          : { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort },
        { opacity: statut === 'bientot' ? 0.75 : 1 },
      ]}
    >
      <View style={styles.haut}>
        <View style={[styles.icone, { backgroundColor: couleur, borderColor: theme.bord.fort }]}>
          <Icone size={22} color={theme.texte.surCouleur} strokeWidth={2} />
        </View>
        <View style={styles.texte}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{titre}</Text>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{sous}</Text>
        </View>
        {libelleStatut ? (
          <View style={[styles.statut, { borderColor: theme.bord.fort, backgroundColor: fond }]}>
            <Pastille size={12} color={texte} strokeWidth={2} />
            <Text style={[typo.legende, { color: texte }]}>{libelleStatut}</Text>
          </View>
        ) : null}
      </View>
      {score ? (
        <Text style={[typo.chiffreL, { color: theme.texte.principal }]}>
          {score.valeur}
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{` ${t('certification.tests.listes.surMax', { max: score.max })}`}</Text>
        </Text>
      ) : null}
      {progression && faits ? (
        <View style={styles.progression}>
          <Text style={[typo.legende, { color: theme.texte.principal }]}>{faits}</Text>
          <BarreProgression pourcent={(progression.faits / progression.total) * 100} libelle={faits} hauteur={8} />
        </View>
      ) : null}
      {detail ? <Text style={[typo.donnee, { color: theme.texte.secondaire }]}>{detail}</Text> : null}
      {action && actif ? (
        <View testID="carte-test-action" style={[styles.action, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{action}</Text>
        </View>
      ) : null}
    </View>
  );
  if (!actif) return contenu;
  const libelle = [titre, libelleStatut, score ? `${score.valeur} ${t('certification.tests.listes.surMax', { max: score.max })}` : null, faits, detail].filter(Boolean).join('. ');
  if (collee) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={libelle} onPress={onPress}>
        {contenu}
      </Pressable>
    );
  }
  return (
    <Appui
      accessibilityRole="button"
      accessibilityLabel={libelle}
      onPress={onPress}
      decalage={3}
      ombre={ombre.m}
      couleurOmbre={theme.ombre}
      rayon={rayon.l}
    >
      {contenu}
    </Appui>
  );
}

/** Icône et fond de la pastille de statut (maquette : fait jaune, en cours vert, interrompu corail, pas fait blanc). */
function pastilleDe(statut: StatutCarteTest, theme: ReturnType<typeof useTheme>['theme']): { Pastille: LucideIcon; fond: string; texte: string } {
  if (statut === 'fait') return { Pastille: Check, fond: theme.accent.soleil, texte: theme.texte.surCouleur };
  if (statut === 'en_cours') return { Pastille: RotateCcw, fond: theme.marque.principale, texte: theme.texte.surCouleur };
  if (statut === 'interrompu') return { Pastille: TriangleAlert, fond: theme.etat.erreurDoux, texte: theme.texte.principal };
  if (statut === 'bientot') return { Pastille: Clock, fond: theme.accent.soleil, texte: theme.texte.surCouleur };
  return { Pastille: Circle, fond: theme.fond.surface, texte: theme.texte.principal };
}

const styles = StyleSheet.create({
  carte: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[4], gap: espace[3] },
  // Ligne d'un bloc collé : le contour et les arrondis sont ceux du GroupeColle.
  collee: { borderWidth: 0, borderRadius: 0 },
  haut: { flexDirection: 'row', alignItems: 'flex-start', gap: espace[3] },
  icone: { width: 44, height: 44, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  texte: { flex: 1, minWidth: 0, gap: 2 },
  statut: { flexDirection: 'row', alignItems: 'center', gap: espace[2], borderWidth: bord.normal, borderRadius: rayon.pilule, paddingHorizontal: espace[3], paddingVertical: 1, alignSelf: 'flex-start' },
  progression: { gap: espace[2] },
  action: { minHeight: 48, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center', paddingHorizontal: espace[4] },
});
