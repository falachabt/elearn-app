import { CalendarDays } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Carte } from '../Carte';
import { useFeedback } from '../useFeedback';

export type TypeEcheance = 'examen' | 'fin_de_cours' | 'concours';
export type Decompte = { jours: number; heures: number; minutes: number; secondes: number; passee: boolean };

/** Sous ce nombre de jours, la carte passe en orange (attention) quel que soit son type. */
export const SEUIL_PROCHE_JOURS = 30;
/** Durée d'affichage du composant complet avant le repli en infobulle à droite (3 secondes). */
export const DUREE_AFFICHAGE_MS = 3_000;

const JOUR = 86_400_000;
const HEURE = 3_600_000;
const MINUTE = 60_000;

/** Temps restant jusqu'à la date cible (minuit, heure locale, du jour cible). Pur : testable sans horloge. */
export function decompter(cible: Date, maintenant: Date): Decompte {
  const reste = cible.getTime() - maintenant.getTime();
  if (reste <= 0) return { jours: 0, heures: 0, minutes: 0, secondes: 0, passee: true };
  return {
    jours: Math.floor(reste / JOUR),
    heures: Math.floor((reste % JOUR) / HEURE),
    minutes: Math.floor((reste % HEURE) / MINUTE),
    secondes: Math.floor((reste % MINUTE) / 1000),
    passee: false,
  };
}

const deuxChiffres = (n: number) => String(n).padStart(2, '0');

export type SegmentDecompte = { unite: 'jours' | 'heures' | 'minutes' | 'secondes'; texte: string; grand: boolean; moyen: boolean };

/**
 * Affichage du décompte : l'unité la plus grande non nulle est la première, en grand. Les unités nulles qui la précèdent
 * disparaissent (0 j → l'heure devient grande). Une seconde en petit, la minute en moyen.
 */
export function segments(d: Decompte, libelles: Record<SegmentDecompte['unite'], string>): SegmentDecompte[] {
  const unites = [
    { unite: 'jours' as const, valeur: d.jours, libelle: libelles.jours },
    { unite: 'heures' as const, valeur: d.heures, libelle: libelles.heures },
    { unite: 'minutes' as const, valeur: d.minutes, libelle: libelles.minutes },
    { unite: 'secondes' as const, valeur: d.secondes, libelle: libelles.secondes },
  ];
  const premier = unites.findIndex((u) => u.valeur > 0);
  const debut = premier < 0 ? unites.length - 1 : premier;
  return unites.slice(debut).map((u, i) => ({
    unite: u.unite,
    texte: `${u.unite === 'jours' ? u.valeur : deuxChiffres(u.valeur)} ${u.libelle}`,
    grand: i === 0,
    moyen: i === 1,
  }));
}

/** Texte court de l'infobulle : nombre de jours restants, ou nombre d'heures s'il reste 0 jour. */
export function texteInfobulle(d: Decompte, libelles: { jours: string; heures: string }): string {
  return d.jours > 0 ? `${d.jours} ${libelles.jours}` : `${d.heures} ${libelles.heures}`;
}

/**
 * Compte à rebours de l'accueil (issue #65) : affiché en grand pendant 6 secondes, puis animé en infobulle compacte
 * alignée à droite sur sa propre rangée (sans jamais chevaucher un autre composant). Un appui sur l'infobulle réaffiche
 * la carte complète pendant 6 secondes avant de revenir en infobulle.
 */
function formaterNomAvecAnnee(libelle: string, cible: Date): string {
  const nomBrut = libelle.split("·")[0].trim();
  const matchAnnee = libelle.match(/\b(20\d{2})\b/);
  const annee = matchAnnee ? matchAnnee[1] : String(cible.getFullYear());
  return /\b20\d{2}\b/.test(nomBrut) ? nomBrut : `${nomBrut} ${annee}`;
}

export function CompteARebours({ type, cible, libelle, estime = false }: { type: TypeEcheance; cible: Date; libelle: string; estime?: boolean }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { reduit } = useFeedback();
  const [maintenant, setMaintenant] = useState(() => new Date());
  const [deploye, setDeploye] = useState(true);
  const [cycle, setCycle] = useState(0);
  const echelle = useSharedValue(1);
  const opacite = useSharedValue(1);

  useEffect(() => {
    const id = setInterval(() => setMaintenant(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!deploye) return undefined;
    const minuterie = setTimeout(() => {
      setDeploye(false);
    }, DUREE_AFFICHAGE_MS);
    return () => clearTimeout(minuterie);
  }, [deploye, cycle]);

  useEffect(() => {
    if (reduit) return;
    if (deploye && cycle > 0) {
      echelle.value = 0.92;
      echelle.value = withSpring(1, { damping: 14, stiffness: 280 });
      opacite.value = withTiming(1, { duration: 180 });
    } else if (!deploye) {
      echelle.value = withSequenceMorph(echelle);
      opacite.value = withTiming(1, { duration: 220 });
    }
    // `echelle` et `opacite` sont des shared values Reanimated : on n'anime qu'aux transitions de `deploye` / `cycle`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deploye, cycle, reduit]);

  const rouvrir = () => {
    setDeploye(true);
    setCycle((c) => c + 1);
  };

  const styleAnime = useAnimatedStyle(() => ({
    transform: [{ scale: echelle.value }],
    opacity: opacite.value,
  }));

  const d = decompter(cible, maintenant);
  // Une date passée n'affiche rien : le caller choisit ce qu'il montre ensuite.
  if (d.passee) return null;

  const proche = d.jours < SEUIL_PROCHE_JOURS;
  const fond = proche ? theme.etat.alerteDoux : type === 'examen' ? theme.accent.soleil : type === 'concours' ? theme.etat.infoDoux : theme.fond.surface;
  // Jaune et orange vifs : texte noir. Surfaces claires ou sombres du thème : texte du thème.
  const encre = type === 'examen' && !proche ? theme.texte.surCouleur : theme.texte.principal;
  const nomInfobulle = formaterNomAvecAnnee(libelle, cible);
  const resumeCourt = texteInfobulle(d, {
    jours: t('accueil.compteARebours.jours'),
    heures: t('accueil.compteARebours.heures'),
  });

  if (!deploye) {
    return (
      <View style={styles.rangeeInfobulle}>
        <Animated.View style={reduit ? undefined : styleAnime}>
          <Appui
            testID="compte-a-rebours-infobulle"
            accessibilityRole="button"
            accessibilityLabel={t('accueil.compteARebours.infobulleA11y', { libelle, temps: resumeCourt })}
            onPress={rouvrir}
            rayon={rayon.pilule}
            ombre={3}
            decalage={2}
            couleurOmbre={theme.ombre}
          >
            <View style={[styles.infobulle, { backgroundColor: fond, borderColor: theme.bord.fort }]}>
              <View style={[styles.iconeInfobulle, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                <CalendarDays size={14} strokeWidth={2.2} color={theme.texte.principal} />
              </View>
              <Text numberOfLines={1} style={[typo.etiquette, styles.libelleInfobulle, { color: encre }]}>
                {nomInfobulle}
              </Text>
              <View style={[styles.separateurInfobulle, { backgroundColor: theme.bord.fort }]} />
              <Text style={[typo.texteFort, { color: encre }]}>{resumeCourt}</Text>
            </View>
          </Appui>
        </Animated.View>
      </View>
    );
  }

  return (
    <Animated.View style={reduit ? undefined : styleAnime}>
      <Carte
        accessible
        accessibilityLabel={`${libelle}${estime ? `, ${t('accueil.compteARebours.estime')}` : ''}, ${d.jours} ${t('accueil.compteARebours.jours')}`}
        style={[styles.carte, { backgroundColor: fond }]}
      >
        <View style={[styles.pastille, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
          <CalendarDays size={20} strokeWidth={2} color={theme.texte.principal} />
        </View>
        <View style={styles.texte}>
          <Text numberOfLines={1} style={[typo.etiquette, { color: encre }]}>
            {libelle}
            {estime ? ` · ${t('accueil.compteARebours.estime')}` : ''}
          </Text>
          <View style={styles.ligne}>
            {segments(d, {
              jours: t('accueil.compteARebours.jours'),
              heures: t('accueil.compteARebours.heures'),
              minutes: t('accueil.compteARebours.minutes'),
              secondes: t('accueil.compteARebours.secondes'),
            }).map((s) => (
              <Text key={s.unite} style={[s.grand ? typo.chiffreL : s.moyen ? typo.donnee : typo.legende, { color: encre }]}>
                {s.texte}
              </Text>
            ))}
          </View>
        </View>
      </Carte>
    </Animated.View>
  );
}

function withSequenceMorph(echelle: { value: number }) {
  echelle.value = 0.9;
  return withSpring(1, { damping: 14, stiffness: 280 });
}

const styles = StyleSheet.create({
  carte: { flexDirection: 'row', alignItems: 'flex-start', gap: espace[3], paddingVertical: espace[3], paddingHorizontal: espace[4] },
  pastille: { width: 36, height: 36, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  texte: { flex: 1, gap: espace[1] },
  ligne: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: espace[2] },
  rangeeInfobulle: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  infobulle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[2],
    paddingVertical: espace[1],
    paddingLeft: espace[2],
    paddingRight: espace[3],
    borderWidth: bord.normal,
    borderRadius: rayon.pilule,
  },
  iconeInfobulle: {
    width: 24,
    height: 24,
    borderWidth: bord.normal,
    borderRadius: rayon.pilule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  libelleInfobulle: { maxWidth: 180 },
  separateurInfobulle: { width: 1.5, height: 14, opacity: 0.35 },
});
