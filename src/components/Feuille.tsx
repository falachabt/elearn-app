import { Ionicons } from '@expo/vector-icons';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Bouton } from './Bouton';

export type ActionFeuille = { libelle: string; onPress: () => void; variante?: 'principal' | 'secondaire' | 'texte'; icone?: ReactNode; badge?: boolean };

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
  /** Au-dessus du titre, sous la poignée (indicateur d'étape). */
  avant?: ReactNode;
  /** Contenu au-dessus du titre (illustration). */
  illustration?: ReactNode;
  /** Titre et texte centrés (feuille d'explication). */
  centre?: boolean;
  children?: ReactNode;
};

function Fond(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" opacity={0.45} />;
}

/**
 * Feuille du bas générique (invitation, confirmation, explication avant une permission) : pastille, titre, texte,
 * une action principale et des actions secondaires. Rendue en modale (`BottomSheetModalProvider` à la racine) : elle
 * part du bas de l'écran du téléphone, au-dessus de la barre d'onglets, quel que soit l'endroit où on la déclare
 * (dans un défilement, sous un en-tête...).
 */
export function Feuille({ ouverte, onFermer, icone, titre, texte, actions, mention, avant, illustration, centre, children }: Props) {
  const { theme } = useTheme();
  const { top, bottom } = useSafeAreaInsets();
  const feuille = useRef<BottomSheetModal>(null);
  // Retirée par le parent (ouverte passe à faux) : ce n'est pas une fermeture de l'élève, on ne rappelle pas onFermer.
  const retiree = useRef(false);
  useEffect(() => {
    if (!ouverte) return;
    retiree.current = false;
    feuille.current?.present();
    return () => {
      retiree.current = true;
    };
  }, [ouverte]);
  if (!ouverte) return null;
  return (
    <BottomSheetModal
      ref={feuille}
      enableDynamicSizing
      topInset={top}
      enablePanDownToClose
      backdropComponent={Fond}
      onDismiss={() => {
        if (!retiree.current) onFermer();
      }}
      handleIndicatorStyle={{ backgroundColor: theme.bord.fort }}
      backgroundStyle={{ backgroundColor: theme.fond.surface, borderColor: theme.bord.fort, borderWidth: bord.normal, borderRadius: rayon.l }}
    >
      <BottomSheetView style={[styles.contenu, { paddingBottom: bottom + espace[5] }]}>
        <View accessibilityViewIsModal style={styles.corps}>
          {avant}
          {illustration}
          {icone ? (
            <View style={[styles.pastille, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
              <Ionicons name={icone} size={24} color={theme.texte.surCouleur} />
            </View>
          ) : null}
          <Text accessibilityRole="header" style={[typo.h2, centre && styles.mention, { color: theme.texte.principal }]}>{titre}</Text>
          {texte ? <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{texte}</Text> : null}
          {children}
          <View style={styles.actions}>
            {actions.map((a) => (
              <View key={a.libelle} style={{ position: 'relative' }}>
                <Bouton variante={a.variante === 'secondaire' || a.variante === 'texte' ? a.variante : undefined} icone={a.icone} libelle={a.libelle} onPress={a.onPress} />
                {a.badge && (
                  <View style={[styles.badge, { backgroundColor: theme.etat.alerte, borderColor: theme.fond.surface }]} />
                )}
              </View>
            ))}
          </View>
          {mention ? <Text style={[typo.legende, styles.mention, { color: theme.texte.secondaire }]}>{mention}</Text> : null}
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  contenu: { gap: espace[4], paddingHorizontal: espace[5] },
  pastille: { width: 48, height: 48, borderRadius: rayon.pilule, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  corps: { gap: espace[4] },
  actions: { gap: espace[3] },
  mention: { textAlign: 'center' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
});
