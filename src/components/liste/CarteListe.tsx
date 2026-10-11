import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';

type Props = {
  titre: string;
  sousTitre?: string;
  /** Pastille de type ou icône, à gauche. */
  gauche?: ReactNode;
  /** Contenu sous le titre à la place du sous-titre (compteurs). */
  bas?: ReactNode;
  /** Pastille d'état à droite ; sinon un chevron. */
  droite?: ReactNode;
  /** Élément fini : fond vert doux, sans ombre, même place dans la liste. */
  fini?: boolean;
  /** Élément en cours : contour vert de 3 px (leçon à continuer). */
  enCours?: boolean;
  /** Fond particulier (fiche de révision en soleil doux, carte « Continuer »). */
  fond?: string;
  /** `fond` est un aplat vif (jaune soleil) : titre, sous-titre et chevron passent en encre noire. */
  surCouleur?: boolean;
  onPress: () => void;
};

/** Carte de liste (revue design, règle 2) : 78 px fixes, titre sur 2 lignes, ombre `carte`. Une seule structure pour quiz, exercices, sujets… */
export function CarteListe({ titre, sousTitre, gauche, bas, droite, fini, enCours, fond, surCouleur, onPress }: Props) {
  const { theme } = useTheme();
  const encre = surCouleur ? theme.texte.surCouleur : theme.texte.principal;
  const encreDouce = surCouleur ? theme.texte.surCouleur : theme.texte.secondaire;
  return (
    <Appui
      accessibilityRole="button"
      accessibilityLabel={sousTitre ? `${titre}. ${sousTitre}` : titre}
      onPress={onPress}
      rayon={rayon.l}
      ombre={fini ? 0 : ombre.carte}
      decalage={fini ? 0 : 2}
      couleurOmbre={theme.ombre}
    >
      <View style={[styles.carte, { backgroundColor: fond ?? (fini ? theme.marque.douce : theme.fond.surface), borderColor: enCours ? theme.marque.principale : theme.bord.fort }, enCours && styles.enCours]}>
        {gauche}
        <View style={styles.flex}>
          <Text numberOfLines={2} style={[typo.texteFort, styles.titre, { color: encre }]}>{titre}</Text>
          {sousTitre ? <Text numberOfLines={1} style={[typo.legende, { color: encreDouce }]}>{sousTitre}</Text> : null}
          {bas}
        </View>
        {droite ?? <ChevronRight size={20} strokeWidth={2} color={encreDouce} />}
      </View>
    </Appui>
  );
}

const styles = StyleSheet.create({
  enCours: { borderWidth: 3 },
  flex: { flex: 1, gap: 2, justifyContent: 'center' },
  titre: { fontSize: 15, lineHeight: 20 },
  // Hauteur fixe de 78 px (décision design du 01/10) : titres d'une ou deux lignes, cartes de même taille, bloc texte centré.
  carte: { height: 78, flexDirection: 'row', alignItems: 'center', gap: espace[4], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.l },
});
