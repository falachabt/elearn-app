import { ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { PastilleType } from '../liste/PastilleType';
import { PiluleCompteur } from '../liste/PiluleCompteur';

/**
 * Bloc aux lignes COLLÉES (maquette vidéos validée par Benny le 26/10/2026) : un seul contour, un trait
 * entre les lignes, les arrondis seulement aux extrémités — et un petit rayon (rayon.m), moins arrondi
 * que les anciennes cartes séparées de la page du cours.
 */
export function GroupeColle({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.groupe,
        {
          backgroundColor: theme.fond.surface,
          borderColor: theme.bord.fort,
          shadowColor: theme.ombre,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type LigneProps = {
  titre: string;
  /** Petit contenu au-dessus du titre (ex. étiquette « PARTIE N » des vidéos). */
  haut?: ReactNode;
  sousTitre?: string;
  gauche?: ReactNode;
  /** Contenu sous le titre à la place du sous-titre (compteurs). */
  bas?: ReactNode;
  /** Élément à droite ; sinon un chevron. */
  droite?: ReactNode;
  fond?: string;
  /** Élément en cours : fond creux, comme la leçon à continuer. */
  enCours?: boolean;
  premier?: boolean;
  onPress: () => void;
};

/** Une ligne du bloc collé : même contenu que CarteListe (titre 2 lignes max), sans son propre contour. */
export function LigneGroupe({ titre, haut, sousTitre, gauche, bas, droite, fond, enCours, premier, onPress }: LigneProps) {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={sousTitre ? `${titre}. ${sousTitre}` : titre}
      onPress={onPress}
      style={[
        styles.ligne,
        !premier && { borderTopWidth: bord.fin, borderTopColor: theme.bord.doux },
        { backgroundColor: fond ?? (enCours ? theme.fond.creux : theme.fond.surface) },
      ]}
    >
      {gauche}
      <View style={styles.flex}>
        {haut}
        <Text numberOfLines={2} style={[typo.texteFort, styles.titre, { color: theme.texte.principal }]}>{titre}</Text>
        {sousTitre ? <Text numberOfLines={1} style={[typo.legende, { color: theme.texte.secondaire }]}>{sousTitre}</Text> : null}
        {bas}
      </View>
      <View style={styles.droite}>{droite ?? <ChevronRight size={20} strokeWidth={2} color={theme.texte.secondaire} />}</View>
    </Pressable>
  );
}

/** Le bloc « S'entraîner sur ce cours » seul (compteurs quiz/exercices), réutilisé au pied du lecteur vidéo. */
export function BlocEntrainement({
  cours,
  nom,
  quiz,
  exercices,
  faits,
  quizFaits,
  libelle,
}: {
  cours: string;
  nom: string;
  quiz: number;
  exercices: number;
  faits: number;
  quizFaits: number;
  libelle: string;
}) {
  return (
    <GroupeColle>
      <LigneGroupe
        premier
        gauche={<PastilleType type="quiz" />}
        titre={libelle}
        bas={
          <View style={styles.compteurs}>
            {quiz ? <PiluleCompteur type="quiz" faits={quizFaits} total={quiz} fini={false} /> : null}
            {exercices ? <PiluleCompteur type="exercice" faits={faits} total={exercices} fini={false} /> : null}
          </View>
        }
        onPress={() => router.push({ pathname: '/entrainement/chapitre', params: { cours, nom } })}
      />
    </GroupeColle>
  );
}

const styles = StyleSheet.create({
  groupe: {
    borderWidth: bord.normal,
    borderRadius: rayon.m,
    overflow: 'hidden',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  ligne: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: espace[4], padding: espace[4] },
  flex: { flex: 1, gap: 2, justifyContent: 'center' },
  titre: { fontSize: 15, lineHeight: 20 },
  droite: { alignSelf: 'center' },
  compteurs: { flexDirection: 'row', gap: espace[2], marginTop: espace[1] },
});
