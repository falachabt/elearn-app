import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { espace } from '@/theme/theme';

/** `padding` partout : en edge-to-edge (Android SDK 57) `adjustResize` ne redimensionne plus la fenêtre. */
export const COMPORTEMENT_CLAVIER = 'padding';

type Visible = (cible: View | null) => void;

const ContexteEcran = createContext<Visible | null>(null);

/** Utilisé par `Champ` : fait défiler l'écran pour garder le champ actif au-dessus du clavier. Sans `Ecran`, ne fait rien. */
export const useRendreVisible = () => useContext(ContexteEcran);

type Props = {
  children: ReactNode;
  /** Contenu défilant (par défaut). `false` : vue fixe, pour un écran court sans saisie longue. */
  defilement?: boolean;
  /** Ajoute l'inset du haut (zone de la barre d'état). Vrai par défaut. */
  insetHaut?: boolean;
  /** Ajoute l'inset du bas (barre de navigation système). Faux dans les onglets, dont la barre s'en charge. */
  insetBas?: boolean;
  /** Bouton ou zone fixe collée en bas, au-dessus du clavier. */
  pied?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contenuStyle?: StyleProp<ViewStyle>;
};

/**
 * Conteneur de tout écran avec saisie (connexion, inscription, code de parrainage, profil…).
 * Règle : tout écran qui contient un `Champ` passe par `Ecran`.
 * - Le clavier ne recouvre jamais le champ : `KeyboardAvoidingView` (comportement `padding`, y compris sur Android
 *   en edge-to-edge où `adjustResize` ne redimensionne plus la fenêtre) + défilement + défilement automatique au focus.
 * - Le fond et les zones système (haut et bas) prennent la couleur du thème.
 */
export function Ecran({ children, defilement = true, insetHaut = true, insetBas = true, pied, style, contenuStyle }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const defileur = useRef<ScrollView>(null);

  const rendreVisible = useCallback<Visible>((cible) => {
    const vue = defileur.current;
    if (!vue || !cible) return;
    // Laisse le clavier finir de monter avant de mesurer.
    setTimeout(() => {
      try {
        const interieur = vue.getInnerViewNode?.();
        if (!interieur) return;
        cible.measureLayout(
          interieur,
          (_x, y) => vue.scrollTo({ y: Math.max(0, y - espace[7]), animated: true }),
          () => {},
        );
      } catch {
        // Pas de mesure possible (web, mock) : le navigateur gère le focus.
      }
    }, 120);
  }, []);
  const contexte = useMemo(() => rendreVisible, [rendreVisible]);

  const padding = { paddingTop: insetHaut ? insets.top + espace[5] : espace[5], paddingBottom: pied ? espace[5] : (insetBas ? insets.bottom : 0) + espace[7] };

  return (
    <ContexteEcran.Provider value={contexte}>
      <KeyboardAvoidingView
        testID="ecran"
        behavior={COMPORTEMENT_CLAVIER}
        style={[styles.racine, { backgroundColor: theme.fond.app }, style]}
      >
        {defilement ? (
          <ScrollView
            ref={defileur}
            testID="ecran-defilement"
            style={styles.racine}
            contentContainerStyle={[styles.contenu, padding, contenuStyle]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            automaticallyAdjustKeyboardInsets
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.racine, styles.contenu, padding, contenuStyle]}>{children}</View>
        )}
        {pied ? <View style={[styles.pied, { paddingBottom: (insetBas ? insets.bottom : 0) + espace[5] }]}>{pied}</View> : null}
      </KeyboardAvoidingView>
    </ContexteEcran.Provider>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1 },
  contenu: { flexGrow: 1, paddingHorizontal: espace[6], gap: espace[6] },
  pied: { paddingHorizontal: espace[6], paddingTop: espace[4], gap: espace[4] },
});
