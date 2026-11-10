import React, { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Info, AlertTriangle, XCircle, X } from 'lucide-react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo, mouvement } from '@/theme/theme';
import { Appui } from '@/components/Appui';

export type TypeToast = 'info' | 'succes' | 'alerte' | 'erreur';

export type OptionsToast = {
  titre: string;
  message?: string;
  type?: TypeToast;
  /** Durée d'affichage en ms (défaut : 4000 ms). Passer 0 ou négatif pour ne pas fermer automatiquement. */
  dureeMs?: number;
  /** Icône personnalisée si nécessaire. Sinon choisie selon le type. */
  icone?: React.ReactNode;
};

type ContexteToastValeur = {
  afficherToast: (options: OptionsToast) => void;
  masquerToast: () => void;
};

const ContexteToast = createContext<ContexteToastValeur>({
  afficherToast: () => {},
  masquerToast: () => {},
});

export function useToast() {
  return useContext(ContexteToast);
}

/**
 * ToastProvider & Toast néo-brutaliste universel pour l'application.
 * Conforme au Design System Elearn Prépa :
 * - Style néo-brutal doux : bordure 2 px, ombre dure décalée (3 px), rayon m (10 px).
 * - Tokens sémantiques uniquement (thème clair et sombre).
 * - Icônes Lucide, pas d'émojis, cible tactile >= 48 px pour la fermeture.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const { top } = useSafeAreaInsets();
  const [toastActuel, setToastActuel] = useState<OptionsToast | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [animOpacite] = useState(() => new Animated.Value(0));
  const [animGlisse] = useState(() => new Animated.Value(-20));

  const masquerToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(animOpacite, { toValue: 0, duration: mouvement.fondu, useNativeDriver: true }),
      Animated.timing(animGlisse, { toValue: -20, duration: mouvement.fondu, useNativeDriver: true }),
    ]).start(() => {
      setToastActuel(null);
    });
  }, [animOpacite, animGlisse]);

  const afficherToast = useCallback(
    (options: OptionsToast) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setToastActuel(options);
      Animated.parallel([
        Animated.timing(animOpacite, { toValue: 1, duration: mouvement.fondu, useNativeDriver: true }),
        Animated.timing(animGlisse, { toValue: 0, duration: mouvement.fondu, useNativeDriver: true }),
      ]).start();

      const duree = options.dureeMs ?? 4000;
      if (duree > 0) {
        timerRef.current = setTimeout(() => {
          masquerToast();
        }, duree);
      }
    },
    [animOpacite, animGlisse, masquerToast],
  );

  const valeur = useMemo(() => ({ afficherToast, masquerToast }), [afficherToast, masquerToast]);

  const type = toastActuel?.type ?? 'info';

  const stylePastille = useMemo(() => {
    switch (type) {
      case 'succes':
        return { fond: theme.marque.principale, icone: <Check size={18} strokeWidth={2.5} color={theme.texte.surCouleur} /> };
      case 'alerte':
        return { fond: theme.accent.soleil, icone: <AlertTriangle size={18} strokeWidth={2.5} color={theme.texte.surCouleur} /> };
      case 'erreur':
        return { fond: theme.etat.erreur, icone: <XCircle size={18} strokeWidth={2.5} color={theme.texte.surCouleur} /> };
      case 'info':
      default:
        return { fond: theme.etat.info, icone: <Info size={18} strokeWidth={2.5} color={theme.texte.surCouleur} /> };
    }
  }, [type, theme]);

  return (
    <ContexteToast.Provider value={valeur}>
      {children}
      {toastActuel ? (
        <Animated.View
          accessibilityRole="alert"
          style={[
            styles.conteneur,
            {
              top: top + espace[3],
              opacity: animOpacite,
              transform: [{ translateY: animGlisse }],
            },
          ]}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.carte,
              {
                backgroundColor: theme.fond.surface,
                borderColor: theme.bord.fort,
              },
            ]}
          >
            <View style={[styles.pastille, { backgroundColor: stylePastille.fond, borderColor: theme.bord.fort }]}>
              {toastActuel.icone ?? stylePastille.icone}
            </View>
            <View style={styles.texte}>
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{toastActuel.titre}</Text>
              {toastActuel.message ? (
                <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{toastActuel.message}</Text>
              ) : null}
            </View>
            <Appui accessibilityRole="button" accessibilityLabel="Fermer" onPress={masquerToast} decalage={0} style={styles.fermer}>
              <View style={[styles.croix, { backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}>
                <X size={16} strokeWidth={2.5} color={theme.texte.principal} />
              </View>
            </Appui>
          </View>
        </Animated.View>
      ) : null}
    </ContexteToast.Provider>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    position: 'absolute',
    left: espace[4],
    right: espace[4],
    zIndex: 99999,
  },
  carte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[3],
    padding: espace[3],
    borderWidth: bord.normal,
    borderRadius: rayon.m,
    borderBottomWidth: bord.normal + ombre.carte,
    borderRightWidth: bord.normal + ombre.carte,
  },
  pastille: {
    width: 34,
    height: 34,
    borderRadius: rayon.s,
    borderWidth: bord.fin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texte: {
    flex: 1,
    gap: espace[1],
  },
  fermer: {
    padding: espace[1],
  },
  croix: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: bord.fin,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
