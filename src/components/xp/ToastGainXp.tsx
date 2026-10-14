import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Sparkles, Trophy, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTraduction } from '@/i18n/useTraduction';
import { calculerNiveau, ecouterGainXp, type InfoGainXp } from '@/services/xp';
import { getSupabase } from '@/services/supabase';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo, mouvement } from '@/theme/theme';
import { Appui } from '../Appui';
import { useReduireAnimations } from '../useReduireAnimations';

export const DUREE_TOAST_XP_MS = 4000;

interface DonneesToast {
  gain: number;
  total: number;
  source: string;
  nouveauNiveau?: number;
}

/**
 * Toast néo-brutaliste discret annonçant un gain d'XP et/ou un passage de niveau.
 * - S'affiche en haut de l'écran lors d'une complétion de mission, quiz ou exercice.
 * - Réactif en ligne comme hors ligne.
 * - Style néo-brutal doux : bordure 2 px, ombre dure décalée, couleurs sémantiques.
 * - Icônes Lucide (Sparkles / Trophy), zéro emoji.
 */
export function ToastGainXp() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { session } = useSession();
  const insets = useSafeAreaInsets();
  const reduit = useReduireAnimations();

  const [donnees, setDonnees] = useState<DonneesToast | null>(null);
  const timerMasquer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [animGlisse] = useState(() => new Animated.Value(-100));
  const [animOpacite] = useState(() => new Animated.Value(0));

  const masquer = useCallback(() => {
    if (timerMasquer.current) {
      clearTimeout(timerMasquer.current);
      timerMasquer.current = null;
    }
    if (reduit) {
      setDonnees(null);
      return;
    }
    Animated.parallel([
      Animated.timing(animGlisse, { toValue: -100, duration: mouvement.fondu, useNativeDriver: true }),
      Animated.timing(animOpacite, { toValue: 0, duration: mouvement.fondu, useNativeDriver: true }),
    ]).start(() => setDonnees(null));
  }, [animGlisse, animOpacite, reduit]);

  const afficher = useCallback(
    (info: InfoGainXp) => {
      if (timerMasquer.current) clearTimeout(timerMasquer.current);

      const avant = calculerNiveau(Math.max(0, info.total - info.gain));
      const apres = calculerNiveau(info.total);
      const levelUp = apres.niveau > avant.niveau ? apres.niveau : undefined;

      setDonnees({
        gain: info.gain,
        total: info.total,
        source: info.source,
        nouveauNiveau: levelUp,
      });

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      if (reduit) {
        animGlisse.setValue(0);
        animOpacite.setValue(1);
      } else {
        animGlisse.setValue(-40);
        animOpacite.setValue(0);
        Animated.parallel([
          Animated.timing(animGlisse, { toValue: 0, duration: mouvement.standard, useNativeDriver: true }),
          Animated.timing(animOpacite, { toValue: 1, duration: mouvement.standard, useNativeDriver: true }),
        ]).start();
      }

      timerMasquer.current = setTimeout(masquer, DUREE_TOAST_XP_MS);
    },
    [animGlisse, animOpacite, masquer, reduit],
  );

  // Nettoyage du timer au démontage
  useEffect(() => {
    return () => {
      if (timerMasquer.current) {
        clearTimeout(timerMasquer.current);
        timerMasquer.current = null;
      }
    };
  }, []);

  // 1. Écoute les gains locaux émis dans l'app (mission, quiz, exercice, même hors-ligne)
  useEffect(() => {
    return ecouterGainXp((info) => {
      afficher(info);
    });
  }, [afficher]);

  // 2. Écoute également en temps réel les insertions dans xp_history sur Supabase si connecté
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || session.user.is_anonymous) return;

    const supabase = getSupabase();
    const canal = supabase
      .channel(`xp-gains-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'xp_history',
          filter: `userid=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { xp_gained?: number; source_type?: string };
          if (!row.xp_gained) return;
          afficher({
            gain: row.xp_gained,
            total: 0, // le calcul du niveau utilisera le palier
            source: row.source_type || 'quiz',
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [session, afficher]);

  if (!donnees) return null;

  const infoPalier = calculerNiveau(donnees.total);
  const couleurBadge = infoPalier.couleur;

  let libelleSous = t('xp.toastQuiz');
  if (donnees.nouveauNiveau) {
    libelleSous = t('xp.toastNiveauSuperieur', { niveau: donnees.nouveauNiveau });
  } else if (donnees.source === 'daily_mission') {
    libelleSous = t('xp.toastMission');
  } else if (donnees.source === 'exercise') {
    libelleSous = t('xp.toastExercise');
  }

  const ouvrirBareme = () => {
    masquer();
    router.push({ pathname: '/xp' } as unknown as never);
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.conteneur,
        {
          top: insets.top + espace[3],
          opacity: animOpacite,
          transform: [{ translateY: animGlisse }],
        },
      ]}
    >
      <Appui onPress={ouvrirBareme} style={styles.flexToast} decalage={0} rayon={rayon.m}>
        <View
          style={[
            styles.carte,
            {
              backgroundColor: theme.fond.surface,
              borderColor: theme.bord.fort,
              shadowColor: theme.ombre,
            },
          ]}
        >
          {/* Pastille icône avec couleur du palier */}
          <View style={[styles.pastille, { backgroundColor: couleurBadge, borderColor: theme.bord.fort }]}>
            {donnees.nouveauNiveau ? (
              <Trophy size={18} strokeWidth={2.4} color="#0A0A0A" />
            ) : (
              <Sparkles size={18} strokeWidth={2.4} color="#0A0A0A" />
            )}
          </View>

          {/* Titre du gain et sous-titre */}
          <View style={styles.textes}>
            <Text style={[typo.h3, styles.titreGain, { color: theme.texte.principal }]}>
              {t('xp.toastGain', { gain: donnees.gain })}
            </Text>
            <Text numberOfLines={1} style={[typo.petit, { color: theme.texte.secondaire }]}>
              {libelleSous}
            </Text>
          </View>

          {/* Bouton fermer discret */}
          <Appui accessibilityRole="button" accessibilityLabel="Fermer" onPress={masquer} decalage={0} hitSlop={8}>
            <View style={[styles.fermer, { borderColor: theme.bord.doux }]}>
              <X size={14} strokeWidth={2.5} color={theme.texte.secondaire} />
            </View>
          </Appui>
        </View>
      </Appui>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    position: 'absolute',
    left: espace[4],
    right: espace[4],
    zIndex: 9999,
    alignItems: 'center',
  },
  flexToast: {
    width: '100%',
    maxWidth: 420,
  },
  carte: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: espace[3],
    paddingHorizontal: espace[4],
    borderWidth: bord.normal,
    borderRadius: rayon.m,
    gap: espace[3],
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: ombre.m,
  },
  pastille: {
    width: 38,
    height: 38,
    borderRadius: rayon.pilule,
    borderWidth: bord.fin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textes: {
    flex: 1,
    gap: 2,
  },
  titreGain: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  fermer: {
    width: 28,
    height: 28,
    borderRadius: rayon.pilule,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
