import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';

export type StatutCarteTest = 'vide' | 'en_cours' | 'interrompu' | 'fait';

export type ProprietesCarteTest = {
  icone: LucideIcon;
  /** Couleur du type de test (maquette v37) : vert, jaune, crème, corail, vert foncé, blanc. */
  couleur: string;
  titre: string;
  /** Détail discret sous le titre (nombre de questions, parties). */
  sous: string;
  /** Statut écrit en mots ; jamais la couleur seule. */
  statut: StatutCarteTest;
  libelleStatut: string;
  /** Score principal en gros, quand il existe. */
  score?: string;
  /** Ligne discrète sous le score (dernier, tentatives). */
  detail?: string;
  onPress?: () => void;
};

/**
 * Carte d'un test de l'onglet Tests (maquette v37) : une icône et une couleur par type, le statut en mots, le score en
 * gros, le détail en petit. Même gabarit pour mini-tests, demi-tests, test complet et corrigé.
 */
export function CarteTest({ icone: Icone, couleur, titre, sous, statut, libelleStatut, score, detail, onPress }: ProprietesCarteTest) {
  const { theme } = useTheme();
  const enAttente = statut === 'vide';
  const contenu = (
    <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
        <View style={styles.haut}>
          <View style={[styles.icone, { backgroundColor: couleur, borderColor: theme.bord.fort }]}>
            <Icone size={22} color={theme.texte.surCouleur} strokeWidth={2} />
          </View>
          <View style={styles.texte}>
            <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{titre}</Text>
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{sous}</Text>
          </View>
          {libelleStatut ? (
            <View style={[styles.statut, { borderColor: theme.bord.fort, backgroundColor: enAttente ? theme.fond.surface : theme.accent.soleilTresDoux }]}>
              <Text style={[typo.legende, { color: theme.texte.principal }]}>{libelleStatut}</Text>
            </View>
          ) : null}
        </View>
        {score ? (
          <View style={styles.bas}>
            <Text style={[typo.chiffreL, { color: theme.texte.principal }]}>{score}</Text>
            {detail ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{detail}</Text> : null}
          </View>
        ) : null}
    </View>
  );
  if (!onPress) return contenu;
  return (
    <Appui
      accessibilityRole="button"
      accessibilityLabel={[titre, libelleStatut, score, detail].filter(Boolean).join('. ')}
      onPress={onPress}
      decalage={3}
      ombre={ombre.s}
      couleurOmbre={theme.ombre}
      rayon={rayon.l}
    >
      {contenu}
    </Appui>
  );
}

const styles = StyleSheet.create({
  carte: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[3], gap: espace[2] },
  haut: { flexDirection: 'row', alignItems: 'flex-start', gap: espace[3] },
  icone: { width: 44, height: 44, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  texte: { flex: 1, minWidth: 0, gap: 2 },
  statut: { borderWidth: bord.fin, borderRadius: rayon.s, paddingHorizontal: espace[2], paddingVertical: 2, alignSelf: 'flex-start' },
  bas: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: espace[2] },
});
