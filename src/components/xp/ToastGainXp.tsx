import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { BookOpen, CheckCircle, Sparkles, Target, Trophy, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTraduction } from '@/i18n/useTraduction';
import { useNotifications } from '@/session/NotificationsProvider';
import { useSession } from '@/session/SessionProvider';
import { getSupabase } from '@/services/supabase';
import {
  calculerNiveau,
  ecouterGainXp,
  enregistrerNotificationNiveau,
  type InfoGainXp,
} from '@/services/xp';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo, mouvement } from '@/theme/theme';
import { Appui } from '../Appui';
import { useReduireAnimations } from '../useReduireAnimations';
import { ConfettisCelebration } from './ConfettisCelebration';

export const DUREE_TOAST_XP_MS = 4000;
export const DUREE_TOAST_LEVEL_UP_MS = 5500;

interface DonneesToast {
  gain: number;
  total: number;
  source: string;
  nouveauNiveau?: number;
}

/**
 * Toast néo-brutaliste discret annonçant un gain d'XP et/ou un passage de niveau.
 * - S'affiche en haut de l'écran lors d'une complétion de mission, quiz, leçon ou exercice.
 * - Réactif en ligne comme hors ligne sans double toast.
 * - Célébration spéciale animée avec confettis et notification système lors d'un passage de niveau.
 * - Style néo-brutal doux : bordure 2 px, ombre dure décalée, couleurs sémantiques.
 * - Icônes Lucide (Target, Sparkles, BookOpen, CheckCircle, Trophy), zéro emoji.
 */
export function ToastGainXp() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const reduit = useReduireAnimations();
  const { session } = useSession();
  const { rafraichir: rafraichirNotifications } = useNotifications();

  const [donnees, setDonnees] = useState<DonneesToast | null>(null);
  const timerMasquer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [animGlisse] = useState(() => new Animated.Value(-100));
  const [animOpacite] = useState(() => new Animated.Value(0));
  const [animEchelle] = useState(() => new Animated.Value(0.85));

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

      if (levelUp) {
        const nomPalier = t(apres.nomCleI18n as never);
        const titreNotif = t('xp.toastNiveauDebloqueTitre', { niveau: levelUp });
        const corpsNotif = t('xp.toastNotificationCorps', { palier: nomPalier });
        let client = null;
        try {
          client = getSupabase();
        } catch {
          // Environnement de test ou hors ligne
        }
        void enregistrerNotificationNiveau(client, session?.user?.id ?? null, levelUp, titreNotif, corpsNotif).then(() => {
          void rafraichirNotifications?.();
        });
      }

      if (reduit) {
        animGlisse.setValue(0);
        animOpacite.setValue(1);
        animEchelle.setValue(1);
      } else {
        animGlisse.setValue(-40);
        animOpacite.setValue(0);
        animEchelle.setValue(levelUp ? 0.75 : 0.9);
        Animated.parallel([
          Animated.timing(animGlisse, { toValue: 0, duration: mouvement.standard, useNativeDriver: true }),
          Animated.timing(animOpacite, { toValue: 1, duration: mouvement.standard, useNativeDriver: true }),
          Animated.spring(animEchelle, {
            toValue: 1,
            friction: levelUp ? 5 : 7,
            tension: 80,
            useNativeDriver: true,
          }),
        ]).start();
      }

      const duree = levelUp ? DUREE_TOAST_LEVEL_UP_MS : DUREE_TOAST_XP_MS;
      timerMasquer.current = setTimeout(masquer, duree);
    },
    [animEchelle, animGlisse, animOpacite, masquer, rafraichirNotifications, reduit, session?.user?.id, t],
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

  // Écoute les gains locaux émis dans l'app (mission, quiz, leçon, exercice)
  useEffect(() => {
    return ecouterGainXp((info) => {
      afficher(info);
    });
  }, [afficher]);

  if (!donnees) return null;

  const infoPalier = calculerNiveau(donnees.total);
  const nomPalier = t(infoPalier.nomCleI18n as never);
  const estLevelUp = !!donnees.nouveauNiveau;

  // Couleurs et icônes sémantiques par source de gain
  let couleurBadge = '#FFD83D'; // Jaune quiz par défaut
  let IconeComposant = Sparkles;
  let titre = t('xp.toastGain', { gain: donnees.gain });
  let sousTitre = t('xp.toastQuiz');

  if (estLevelUp) {
    couleurBadge = infoPalier.couleur;
    IconeComposant = Trophy;
    titre = t('xp.toastNiveauDebloqueTitre', { niveau: donnees.nouveauNiveau });
    sousTitre = t('xp.toastNiveauDebloqueSous', { palier: nomPalier });
  } else if (donnees.source === 'daily_mission') {
    couleurBadge = '#10B981'; // Vert émeraude de la mission
    IconeComposant = Target;
    sousTitre = t('xp.toastMission');
  } else if (donnees.source === 'course') {
    couleurBadge = '#5B9BFF'; // Bleu cours
    IconeComposant = BookOpen;
    sousTitre = t('xp.toastCourse');
  } else if (donnees.source === 'exercise') {
    couleurBadge = '#B69CFF'; // Lilas exercice
    IconeComposant = CheckCircle;
    sousTitre = t('xp.toastExercise');
  }

  const ouvrirBareme = () => {
    masquer();
    router.push({ pathname: '/xp', params: { totalXp: String(donnees.total) } } as unknown as never);
  };

  return (
    <>
      {estLevelUp ? <ConfettisCelebration /> : null}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.conteneur,
          {
            top: insets.top + espace[3],
            opacity: animOpacite,
            transform: [{ translateY: animGlisse }, { scale: animEchelle }],
          },
        ]}
      >
        <Appui onPress={ouvrirBareme} style={styles.flexToast} decalage={0} rayon={rayon.m}>
          <View
            style={[
              styles.carte,
              {
                backgroundColor: theme.fond.surface,
                borderColor: estLevelUp ? couleurBadge : theme.bord.fort,
                borderWidth: estLevelUp ? 3 : bord.normal,
                shadowColor: estLevelUp ? couleurBadge : theme.ombre,
              },
            ]}
          >
            {/* Pastille icône avec couleur sémantique */}
            <View
              style={[
                styles.pastille,
                estLevelUp && styles.pastilleLevelUp,
                { backgroundColor: couleurBadge, borderColor: theme.bord.fort },
              ]}
            >
              <IconeComposant size={estLevelUp ? 22 : 18} strokeWidth={2.4} color="#0A0A0A" />
            </View>

            {/* Titre du gain / déblocage et sous-titre */}
            <View style={styles.textes}>
              <Text
                numberOfLines={1}
                style={[
                  typo.h3,
                  styles.titreGain,
                  { color: theme.texte.principal },
                  estLevelUp && styles.titreLevelUp,
                ]}
              >
                {titre}
              </Text>
              <Text numberOfLines={1} style={[typo.petit, { color: theme.texte.secondaire }]}>
                {sousTitre}
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
    </>
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
  pastilleLevelUp: {
    width: 44,
    height: 44,
    borderWidth: bord.normal,
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
  titreLevelUp: {
    fontSize: 17,
    fontWeight: '900',
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
