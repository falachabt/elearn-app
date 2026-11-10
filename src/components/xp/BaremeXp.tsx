import { router } from 'expo-router';
import { Award, ChevronLeft } from 'lucide-react-native';
import { StyleSheet, Text, View, ScrollView } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { BAREME_XP, calculerNiveau, PALIERS_NIVEAU } from '@/services/xp';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Ecran } from '../Ecran';

interface Props {
  totalXp?: number;
}

/**
 * Page publique présentant le barème d'XP et les 10 échelons de niveaux.
 * - Transparence totale : aucun emoji, icônes Lucide.
 * - Règle d'or : aucune valeur monétaire, non convertible en crédits.
 */
export function BaremeXp({ totalXp = 0 }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const info = calculerNiveau(totalXp);

  return (
    <Ecran
      entete={
        <View style={styles.entete}>
          <Appui
            accessibilityRole="button"
            accessibilityLabel={t('reglages.retour')}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/moi'))}
            rayon={rayon.m}
            decalage={0}
            hitSlop={8}
          >
            <View style={[styles.btnRetour, { borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]}>
              <ChevronLeft size={20} strokeWidth={2.2} color={theme.texte.principal} />
            </View>
          </Appui>
          <Text accessibilityRole="header" style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>
            {t('xp.titre')}
          </Text>
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Règle d'or d'effort et d'éthique */}
        <View style={[styles.carteRegle, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
          <Text style={[typo.petit, { color: theme.texte.surCouleur }]}>
            {t('xp.introRegle')}
          </Text>
        </View>

        {/* Section 1 : Barème des gains */}
        <View style={styles.section}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>
            {t('xp.baremeSection')}
          </Text>
          <View style={[styles.table, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            {BAREME_XP.map((b, index) => (
              <View
                key={b.source}
                style={[
                  styles.ligneBareme,
                  index < BAREME_XP.length - 1 && { borderBottomColor: theme.bord.doux, borderBottomWidth: bord.fin },
                ]}
              >
                <Text style={[typo.texte, styles.flex, { color: theme.texte.principal }]}>
                  {t(b.cleI18n as never)}
                </Text>
                <View style={[styles.badgeGain, { borderColor: theme.marque.principale, backgroundColor: theme.marque.douce }]}>
                  <Text style={[typo.donnee, { color: theme.marque.forte, fontWeight: '700' }]}>
                    +{b.gain} XP
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Section 2 : Les 10 paliers de niveau */}
        <View style={styles.section}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>
            {t('xp.paliersSection')}
          </Text>
          <View style={styles.listePaliers}>
            {PALIERS_NIVEAU.map((p) => {
              const estNiveauActuel = info.niveau === p.niveau;
              const nomNiveau = t(p.nomCleI18n as never);
              const seuilTexte = p.seuilSuivant !== null ? `${p.seuilMin} à ${p.seuilSuivant - 1} XP` : `${p.seuilMin}+ XP`;

              return (
                <View
                  key={p.niveau}
                  style={[
                    styles.cartePalier,
                    {
                      backgroundColor: estNiveauActuel ? theme.marque.douce : theme.fond.surface,
                      borderColor: estNiveauActuel ? theme.marque.principale : theme.bord.fort,
                    },
                  ]}
                >
                  <View style={[styles.pastilleNiveau, { backgroundColor: p.couleur, borderColor: theme.bord.fort }]}>
                    <Text style={[typo.boutonPetit, { color: '#0A0A0A' }]}>{p.niveau}</Text>
                  </View>
                  <View style={styles.flex}>
                    <View style={styles.ligneNom}>
                      <Text style={[typo.texteFort, { color: estNiveauActuel ? theme.marque.forte : theme.texte.principal }]}>
                        {nomNiveau}
                      </Text>
                      {estNiveauActuel ? (
                        <View style={[styles.badgeActuel, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
                          <Award size={12} color="#0A0A0A" />
                          <Text style={[typo.etiquette, { color: '#0A0A0A' }]}>{t('xp.tonNiveau')}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[typo.donnee, { color: theme.texte.secondaire }]}>{seuilTexte}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  btnRetour: {
    width: 40,
    height: 40,
    borderRadius: rayon.m,
    borderWidth: bord.normal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { gap: espace[5], paddingBottom: espace[8] },
  carteRegle: {
    padding: espace[4],
    borderWidth: bord.normal,
    borderRadius: rayon.l,
    boxShadow: `3px 3px 0 ${ombre.carte}px`,
  },
  section: { gap: espace[3] },
  table: {
    borderWidth: bord.normal,
    borderRadius: rayon.l,
    overflow: 'hidden',
  },
  ligneBareme: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: espace[4],
    paddingVertical: espace[3],
  },
  badgeGain: {
    borderWidth: bord.fin,
    borderRadius: rayon.s,
    paddingHorizontal: espace[2],
    paddingVertical: espace[1],
  },
  listePaliers: { gap: espace[2] },
  cartePalier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[3],
    padding: espace[3],
    borderWidth: bord.normal,
    borderRadius: rayon.m,
  },
  pastilleNiveau: {
    width: 36,
    height: 36,
    borderRadius: rayon.s,
    borderWidth: bord.normal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ligneNom: { flexDirection: 'row', alignItems: 'center', gap: espace[2] },
  badgeActuel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[1],
    paddingHorizontal: espace[2],
    paddingVertical: 2,
    borderRadius: rayon.s,
    borderWidth: bord.fin,
  },
});
