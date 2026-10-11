import AsyncStorage from '@react-native-async-storage/async-storage';
import { Zap, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTraduction } from '@/i18n/useTraduction';
import { lireRechargeRecente } from '@/services/credits';
import { getSupabase } from '@/services/supabase';
import { useCredits } from '@/session/CreditsProvider';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo, mouvement } from '@/theme/theme';
import { Appui } from '../Appui';

export const CLE_RECHARGE_VUE = 'credits.rechargeVue';
/** Fenêtre de détection de la recharge : les 48 dernières heures (lundi et mardi). */
export const FENETRE_RECHARGE_MS = 48 * 60 * 60 * 1000;
export const DUREE_AFFICHAGE_MS = 6000;

/**
 * Toast néo-brutaliste discret annonçant la recharge hebdomadaire des 25 crédits (M18-02, N1).
 * Respecte scrupuleusement le design system :
 * - Style néo-brutal doux : bordure 2 px (`bord.normal`), ombre dure sans flou (`ombre.m`), rayon 10 (`rayon.m`).
 * - Couleurs sémantiques uniquement : `theme.fond.surface`, `theme.bord.fort`, `theme.accent.soleil`, `theme.texte.principal`.
 * - Icônes Lucide (Zap, X), pas d'émojis, cibles tactiles >= 48 px.
 * - Disparaît automatiquement ou via le bouton fermer.
 */
export function ToastRechargeCredits() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { session } = useSession();
  const { solde } = useCredits();
  const { top } = useSafeAreaInsets();
  const [recharge, setRecharge] = useState<{ id: string; montant: number } | null>(null);
  const verifie = useRef<string | null>(null);
  const [animOpacite] = useState(() => new Animated.Value(0));
  const [animGlisse] = useState(() => new Animated.Value(-20));

  const utilisateur = session?.user.id ?? null;
  const connecte = !!session && !session.user.is_anonymous;
  const pret = !!solde;

  useEffect(() => {
    if (!utilisateur || !connecte || !pret || verifie.current === utilisateur) return;
    verifie.current = utilisateur;
    let actif = true;

    void (async () => {
      const r = await lireRechargeRecente(getSupabase(), new Date(Date.now() - FENETRE_RECHARGE_MS).toISOString());
      if (!r) return;
      const vue = await AsyncStorage.getItem(`${CLE_RECHARGE_VUE}.${utilisateur}`);
      if (vue === r.id) return;
      if (actif) {
        setRecharge(r);
        Animated.parallel([
          Animated.timing(animOpacite, { toValue: 1, duration: mouvement.fondu, useNativeDriver: true }),
          Animated.timing(animGlisse, { toValue: 0, duration: mouvement.fondu, useNativeDriver: true }),
        ]).start();
      }
    })().catch(() => {});

    return () => {
      actif = false;
    };
  }, [utilisateur, connecte, pret, animOpacite, animGlisse]);

  const fermer = useCallback(() => {
    if (utilisateur && recharge) {
      void AsyncStorage.setItem(`${CLE_RECHARGE_VUE}.${utilisateur}`, recharge.id).catch(() => {});
    }
    Animated.parallel([
      Animated.timing(animOpacite, { toValue: 0, duration: mouvement.fondu, useNativeDriver: true }),
      Animated.timing(animGlisse, { toValue: -20, duration: mouvement.fondu, useNativeDriver: true }),
    ]).start(() => setRecharge(null));
  }, [utilisateur, recharge, animOpacite, animGlisse]);

  useEffect(() => {
    if (!recharge) return;
    const timer = setTimeout(fermer, DUREE_AFFICHAGE_MS);
    return () => clearTimeout(timer);
  }, [recharge, fermer]);

  if (!recharge) return null;

  return (
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
        <View style={[styles.pastille, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
          <Zap size={18} strokeWidth={2.5} color={theme.texte.surCouleur} />
        </View>
        <View style={styles.texte}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('credits.toastRechargeHebdo')}</Text>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('credits.toastRechargeHebdoTexte')}</Text>
        </View>
        <Appui accessibilityRole="button" accessibilityLabel={t('credits.fermer')} onPress={fermer} decalage={0} style={styles.fermer}>
          <View style={[styles.croix, { backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}>
            <X size={16} strokeWidth={2.5} color={theme.texte.principal} />
          </View>
        </Appui>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    position: 'absolute',
    left: espace[4],
    right: espace[4],
    zIndex: 9999,
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
