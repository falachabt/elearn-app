import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Bouton } from './Bouton';

export type ActionFeuille = { libelle: string; onPress: () => void; variante?: 'principal' | 'secondaire' };

type Props = {
  ouverte: boolean;
  /** Appelé quand la feuille se ferme (glissée vers le bas, fond touché ou action secondaire). */
  onFermer: () => void;
  icone?: keyof typeof Ionicons.glyphMap;
  titre: string;
  texte?: string;
  actions: ActionFeuille[];
  /** Petite mention sous les boutons. */
  mention?: string;
  children?: ReactNode;
};

function Fond(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" opacity={0.45} />;
}

/**
 * Feuille du bas générique (invitation, confirmation, explication avant une permission) : pastille, titre, texte,
 * une action principale et des actions secondaires. À rendre à côté de l'écran, pas dans son défilement.
 */
export function Feuille({ ouverte, onFermer, icone, titre, texte, actions, mention, children }: Props) {
  const { theme } = useTheme();
  const { top, bottom } = useSafeAreaInsets();
  const feuille = useRef<BottomSheet>(null);
  if (!ouverte) return null;
  return (
    <BottomSheet
      ref={feuille}
      index={0}
      enableDynamicSizing
      topInset={top}
      enablePanDownToClose
      backdropComponent={Fond}
      onClose={onFermer}
      handleIndicatorStyle={{ backgroundColor: theme.bord.fort }}
      backgroundStyle={{ backgroundColor: theme.fond.surface, borderColor: theme.bord.fort, borderWidth: bord.normal, borderRadius: rayon.l }}
    >
      <BottomSheetView style={[styles.contenu, { paddingBottom: bottom + espace[5] }]}>
        <View accessibilityViewIsModal style={styles.corps}>
          {icone ? (
            <View style={[styles.pastille, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
              <Ionicons name={icone} size={24} color={theme.texte.surCouleur} />
            </View>
          ) : null}
          <Text accessibilityRole="header" style={[typo.h2, { color: theme.texte.principal }]}>{titre}</Text>
          {texte ? <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{texte}</Text> : null}
          {children}
          <View style={styles.actions}>
            {actions.map((a) => (
              <Bouton key={a.libelle} variante={a.variante === 'secondaire' ? 'secondaire' : undefined} libelle={a.libelle} onPress={a.onPress} />
            ))}
          </View>
          {mention ? <Text style={[typo.legende, styles.mention, { color: theme.texte.secondaire }]}>{mention}</Text> : null}
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  contenu: { gap: espace[4], paddingHorizontal: espace[5] },
  pastille: { width: 48, height: 48, borderRadius: rayon.pilule, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  corps: { gap: espace[4] },
  actions: { gap: espace[3] },
  mention: { textAlign: 'center' },
});
