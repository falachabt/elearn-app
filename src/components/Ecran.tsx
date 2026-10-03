import { ArrowUp } from 'lucide-react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon } from '@/theme/theme';

import { Appui } from './Appui';

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
  /** En-tête fixe (retour + titre) : reste visible pendant le défilement. */
  entete?: ReactNode;
  /** Style de l'en-tête (bandeau de couleur d'une matière). */
  enteteStyle?: StyleProp<ViewStyle>;
  /** Bouton « Revenir en haut » après un long défilement (vrai par défaut). */
  retourHaut?: boolean;
  /** Bouton ou zone fixe collée en bas, au-dessus du clavier. */
  pied?: ReactNode;
  /** Pied pleine largeur, bord à bord, collé au clavier (barre de saisie) : sans marge, et sans inset du bas quand le clavier est ouvert. */
  piedPleineLargeur?: boolean;
  /** Revient en haut du défilement chaque fois que cette valeur change (ex. bascule énoncé / corrigé). */
  remonterSur?: unknown;
  style?: StyleProp<ViewStyle>;
  contenuStyle?: StyleProp<ViewStyle>;
};

/**
 * Conteneur de tout écran avec saisie (connexion, inscription, code de parrainage, profil…).
 * Règle : tout écran qui contient un `Champ` passe par `Ecran`.
 * - Le clavier ne recouvre jamais le champ : `KeyboardAvoidingView` (comportement `padding`, y compris sur Android
 *   en edge-to-edge où `adjustResize` ne redimensionne plus la fenêtre) + défilement + défilement automatique au focus.
 * - Le fond et les zones système (haut et bas) prennent la couleur du thème ; le contenu ne passe jamais sous la
 *   barre d'état ni sous la barre de navigation, même en défilant.
 */
export function Ecran({ children, defilement = true, insetHaut = true, insetBas = true, entete, enteteStyle, retourHaut = true, pied, piedPleineLargeur, remonterSur, style, contenuStyle }: Props) {
  const { theme } = useTheme();
  const { t } = useTraduction();
  const { height } = useWindowDimensions();
  const [defile, setDefile] = useState({ separateur: false, haut: false });
  const insets = useSafeAreaInsets();
  const defileur = useRef<ScrollView>(null);
  // Clavier ouvert : plus d'inset du bas ni de grande marge sous le pied. Le clavier couvre déjà la barre système ; garder
  // ces marges laissait un vide entre le contenu (ou le bouton) et le clavier.
  const [clavier, setClavier] = useState(false);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const a = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setClavier(true));
    const b = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setClavier(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

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
  useEffect(() => {
    defileur.current?.scrollTo?.({ y: 0, animated: false });
  }, [remonterSur]);

  const suivreDefilement = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const suivant = { separateur: y > 4, haut: retourHaut && y > height * 1.5 };
      setDefile((d) => (d.separateur === suivant.separateur && d.haut === suivant.haut ? d : suivant));
    },
    [height, retourHaut],
  );

  // Les insets sont posés sur un cadre fixe, hors du défilement : le contenu qui défile est coupé sous la barre
  // d'état et au-dessus de la barre de navigation, au lieu de passer derrière l'heure et la batterie (edge-to-edge).
  const cadre = { paddingTop: insetHaut ? insets.top : 0, paddingBottom: !pied && insetBas && !clavier ? insets.bottom : 0 };
  const padding = { paddingTop: espace[5], paddingBottom: pied ? espace[5] : espace[7] };

  return (
    <ContexteEcran.Provider value={contexte}>
      <KeyboardAvoidingView
        testID="ecran"
        behavior={COMPORTEMENT_CLAVIER}
        style={[styles.racine, { backgroundColor: theme.fond.app }, style]}
      >
        <View testID="ecran-cadre" style={[styles.racine, cadre]}>
          {entete ? (
            <View
              testID="ecran-entete"
              style={[styles.entete, { backgroundColor: theme.fond.app, borderBottomColor: defile.separateur ? theme.bord.fort : 'transparent' }, enteteStyle]}
            >
              {entete}
            </View>
          ) : null}
          {/* Le bouton « Revenir en haut » est posé sur la zone qui défile : il reste au-dessus du pied. */}
          <View style={styles.racine}>
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
                onScroll={suivreDefilement}
                scrollEventThrottle={64}
              >
                {children}
              </ScrollView>
            ) : (
              <View style={[styles.racine, styles.contenu, padding, contenuStyle]}>{children}</View>
            )}
            {defile.haut ? (
              <View style={styles.haut}>
                <Appui
                  accessibilityRole="button"
                  accessibilityLabel={t('ecrans.retourHaut')}
                  onPress={() => defileur.current?.scrollTo({ y: 0, animated: true })}
                  rayon={rayon.m}
                  ombre={3}
                  decalage={2}
                  couleurOmbre={theme.ombre}
                >
                  <View style={[styles.hautBouton, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                    <ArrowUp size={20} strokeWidth={2.25} color={theme.texte.principal} />
                  </View>
                </Appui>
              </View>
            ) : null}
          </View>
          {pied ? (
            piedPleineLargeur ? (
              <View testID="ecran-pied-large" style={{ paddingBottom: insetBas && !clavier ? insets.bottom : 0 }}>{pied}</View>
            ) : (
              <View testID="ecran-pied" style={[styles.pied, { paddingBottom: clavier ? espace[3] : (insetBas ? insets.bottom : 0) + espace[5] }]}>{pied}</View>
            )
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </ContexteEcran.Provider>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1 },
  contenu: { flexGrow: 1, paddingHorizontal: espace[6], gap: espace[6] },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[4], paddingHorizontal: espace[6], paddingTop: espace[4], paddingBottom: espace[3], borderBottomWidth: bord.fin },
  haut: { position: 'absolute', right: espace[4], bottom: espace[4] },
  hautBouton: { width: 40, height: 40, borderRadius: rayon.m, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  pied: { paddingHorizontal: espace[6], paddingTop: espace[4], gap: espace[4] },
});
