import { router, type Href } from 'expo-router';
import { Award, ChevronRight } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { calculerNiveau } from '@/services/xp';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';

interface Props {
  totalXp: number;
}

/**
 * Carte d'effort XP & Niveau pour l'écran Moi (H1).
 * Respecte le design system néo-brutal doux :
 * - Jauge de progression vers le prochain niveau
 * - Badge de niveau avec la couleur du palier
 * - Accès au barème transparent en un tap
 */
export function CarteXp({ totalXp }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const info = calculerNiveau(totalXp);
  const nomPalier = t(info.nomCleI18n as never);
  const pctProgression = Math.round(info.ratioProgression * 100);

  return (
    <Appui
      accessibilityRole="button"
      accessibilityLabel={`${t('xp.palierTitre', { niveau: info.niveau, nom: nomPalier })}, ${t('xp.pointsTotal', { n: info.totalXp })}`}
      onPress={() => router.push({ pathname: '/xp', params: { totalXp: String(totalXp) } } as unknown as Href)}
      rayon={rayon.l}
      ombre={ombre.carte}
      decalage={2}
      couleurOmbre={theme.ombre}
    >
      <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
        {/* Ligne d'en-tête du niveau */}
        <View style={styles.ligneEntete}>
          <View style={[styles.badgeNiveau, { backgroundColor: info.couleur, borderColor: theme.bord.fort }]}>
            <Award size={14} color="#0A0A0A" />
            <Text style={[typo.etiquette, { color: '#0A0A0A' }]}>
              {t('xp.palierTitre', { niveau: info.niveau, nom: nomPalier })}
            </Text>
          </View>
          <View style={styles.ligneXp}>
            <Text style={[typo.h3, { color: theme.texte.principal }]}>{info.totalXp}</Text>
            <Text style={[typo.donnee, { color: theme.texte.secondaire }]}> XP</Text>
          </View>
        </View>

        {/* Rail de progression */}
        <View style={styles.zoneRail}>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: pctProgression }}
            style={[styles.rail, { backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}
          >
            <View style={[styles.remplissage, { width: `${pctProgression}%`, backgroundColor: info.couleur }]} />
          </View>
          <View style={styles.ligneDetails}>
            <Text style={[typo.legende, { color: theme.texte.secondaire }]}>
              {info.seuilSuivant !== null
                ? t('xp.pourSuivant', { n: info.xpRequisPourSuivant, niveau: info.niveau + 1 })
                : t('xp.maxAtteint')}
            </Text>
            {info.seuilSuivant !== null ? (
              <Text style={[typo.donnee, { color: theme.texte.principal, fontWeight: '700' }]}>
                {info.seuilSuivant} XP
              </Text>
            ) : null}
          </View>
        </View>

        {/* Pied avec lien barème */}
        <View style={[styles.pied, { borderTopColor: theme.bord.doux }]}>
          <Text style={[typo.petit, styles.flex, { color: theme.marque.forte, fontWeight: '700' }]}>
            {t('xp.voirBareme')}
          </Text>
          <ChevronRight size={16} color={theme.marque.forte} />
        </View>
      </View>
    </Appui>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  carte: {
    padding: espace[4],
    borderWidth: bord.normal,
    borderRadius: rayon.l,
    gap: espace[3],
  },
  ligneEntete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeNiveau: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[2],
    paddingHorizontal: espace[3],
    paddingVertical: espace[1],
    borderRadius: rayon.s,
    borderWidth: bord.normal,
  },
  ligneXp: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  zoneRail: {
    gap: espace[1],
  },
  rail: {
    height: 12,
    borderRadius: rayon.pilule,
    borderWidth: bord.fin,
    overflow: 'hidden',
  },
  remplissage: {
    height: '100%',
    borderRadius: rayon.pilule,
  },
  ligneDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pied: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: espace[2],
    borderTopWidth: bord.fin,
  },
});
