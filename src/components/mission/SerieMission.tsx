import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Carte } from '../Carte';
import { useFeedback } from '../useFeedback';

/** Délai entre deux valeurs du compteur : assez lent pour être lu, assez court pour ne pas lasser. */
export const PAS_COMPTE_MS = 180;
/** Attente avant le premier pas, le temps que la carte apparaisse. */
const DELAI_DEPART_MS = 300;
const TAILLE_PASTILLE = 38;
const TAILLE_FLAMME = 34;
/** Initiales des jours, lundi d'abord (clés littérales pour le typage de `t`). */
const CLES_JOURS = ['mission.jourCourt1', 'mission.jourCourt2', 'mission.jourCourt3', 'mission.jourCourt4', 'mission.jourCourt5', 'mission.jourCourt6', 'mission.jourCourt7'] as const;

/** Clé « AAAA-MM-JJ » d'une date en heure locale (même format que `jourLocal` du service mission). */
const cleDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const aujourdhuiLocal = () => cleDe(new Date());

export type JourSerie = {
  cle: string;
  joue: boolean;
  aujourdhui: boolean;
  /** Indice du jour de la semaine (0 = lundi … 6 = dimanche). */
  jourIndice: number;
  /** Numéro du jour dans le mois (1 à 31). */
  numero: number;
};

/** Fenêtre de 7 jours centrée sur `aujourdhui` (3 jours avant, aujourd'hui au milieu, 3 jours après), avec l'initiale et le quantième. */
export function semaineDe(aujourdhui: string, joues: readonly string[]): JourSerie[] {
  const [a, m, j] = aujourdhui.split('-').map(Number);
  const ensemble = new Set(joues);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(a, m - 1, j - 3 + i);
    const cle = cleDe(date);
    return {
      cle,
      joue: ensemble.has(cle),
      aujourdhui: cle === aujourdhui,
      jourIndice: (date.getDay() + 6) % 7,
      numero: date.getDate(),
    };
  });
}

/** Valeurs successives du compteur, de `de` à `a` inclus (une seule valeur si rien à animer). */
export function suiteCompte(de: number, a: number): number[] {
  if (a <= de) return [a];
  return Array.from({ length: a - de + 1 }, (_, i) => de + i);
}

/**
 * Série du jour à la fin de la mission et dans la feuille de série : le compteur monte de la série précédente à la nouvelle,
 * la flamme pulse une fois et la bande de 7 jours est centrée sur aujourd'hui (3 jours avant, aujourd'hui au milieu, 3 jours après)
 * avec l'initiale du jour et son numéro dans le mois.
 */
export function SerieMission({ serie, joues, aujourdhui = aujourdhuiLocal(), compact = false }: { serie: number; joues: readonly string[]; aujourdhui?: string; compact?: boolean }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { reduit } = useFeedback();
  const depart = Math.max(serie - 1, 0);
  // Valeur du compteur, rattachée à la série qui l'a produite : quand la série change, on repart de `depart`
  // au rendu (sans setState dans l'effet), puis les pas de l'effet remplacent la valeur.
  const cleCompte = `${depart}:${serie}`;
  const [compte, setCompte] = useState({ cle: cleCompte, valeur: reduit ? serie : depart });
  const affiche = compte.cle === cleCompte ? compte.valeur : depart;
  const flamme = useSharedValue(1);

  useEffect(() => {
    // Réduire les animations : la valeur finale est affichée directement au rendu (voir plus bas), rien à animer.
    if (reduit) return;
    const suite = suiteCompte(depart, serie);
    let i = 0;
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    const pas = () => {
      i++;
      if (i >= suite.length) return;
      setCompte({ cle: cleCompte, valeur: suite[i] });
      minuterie = setTimeout(pas, PAS_COMPTE_MS);
    };
    minuterie = setTimeout(pas, DELAI_DEPART_MS + PAS_COMPTE_MS);
    return () => clearTimeout(minuterie);
  }, [cleCompte, depart, serie, reduit]);

  useEffect(() => {
    if (reduit) return;
    flamme.value = withDelay(DELAI_DEPART_MS, withSequence(withTiming(1.18, { duration: 160 }), withSpring(1, { damping: 8, stiffness: 400, mass: 0.6 })));
  }, [flamme, reduit, serie]);

  const animeFlamme = useAnimatedStyle(() => ({ transform: [{ scale: flamme.value }] }));
  const jours = semaineDe(aujourdhui, joues);

  const contenu = (
    <>
      <View style={styles.entete}>
        <Animated.View style={[styles.flamme, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }, reduit ? undefined : animeFlamme]}>
          <Ionicons name="flame" size={18} color={theme.texte.surCouleur} />
        </Animated.View>
        <Text style={[typo.etiquette, styles.flex, { color: theme.texte.principal }]}>{t('mission.maSerie')}</Text>
        <Text accessibilityLiveRegion="polite" style={[typo.chiffreL, { color: theme.texte.principal }]}>{reduit ? serie : affiche}</Text>
        <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t(serie > 1 ? 'mission.joursDeSuite' : 'mission.jourDeSuite')}</Text>
      </View>
      <View style={styles.semaine}>
        {jours.map((jour) => {
          const initiale = t(CLES_JOURS[jour.jourIndice]);
          return (
            <View
              key={jour.cle}
              testID={jour.aujourdhui ? 'serie-jour-aujourdhui' : undefined}
              style={[
                styles.jour,
                jour.aujourdhui
                  ? [styles.jourAujourdhui, { backgroundColor: theme.marque.douce, borderColor: theme.bord.fort }]
                  : undefined,
              ]}
            >
              <Text style={[typo.legende, { color: jour.aujourdhui ? theme.texte.principal : theme.texte.secondaire }]}>{initiale}</Text>
              <Text style={[typo.etiquette, { color: jour.aujourdhui ? theme.texte.principal : theme.texte.secondaire }]}>{jour.numero}</Text>
              <View accessible accessibilityLabel={`${initiale} ${jour.numero} : ${jour.joue ? t('mission.jourJoue') : t('mission.jourNonJoue')}`} style={styles.pastille}>
                <Ionicons name={jour.joue ? 'flame' : 'flame-outline'} size={TAILLE_FLAMME} color={jour.joue ? theme.accent.soleil : theme.texte.secondaire} />
              </View>
            </View>
          );
        })}
      </View>
    </>
  );

  // Version compacte (pied de l'écran, toujours visible) : sans carte, pastilles plus petites.
  return compact ? <View style={styles.compact}>{contenu}</View> : <Carte>{contenu}</Carte>;
}

const styles = StyleSheet.create({
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[3], flexWrap: 'wrap' },
  flex: { flex: 1 },
  flamme: { width: 34, height: 34, borderRadius: rayon.s, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  compact: { gap: espace[3] },
  semaine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: espace[4] },
  jour: { alignItems: 'center', gap: 2, paddingVertical: espace[1], paddingHorizontal: espace[1], borderRadius: rayon.m },
  jourAujourdhui: { borderWidth: bord.normal },
  pastille: { width: TAILLE_PASTILLE, height: TAILLE_PASTILLE, alignItems: 'center', justifyContent: 'center' },
});
