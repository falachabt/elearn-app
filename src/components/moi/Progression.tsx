import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireActivitesJours, type ActiviteJour } from '@/services/activite';
import { calculerProgression, lirePassages, type Passage, type Progression as Donnees } from '@/services/progression';
import { getSupabase } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, matiere as couleursMatiere, matiereSecours, ombre, palette, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Banniere } from '../Banniere';
import { Ecran } from '../Ecran';
import { CarteListe } from '../liste/CarteListe';
import { PastilleType } from '../liste/PastilleType';
import { Onglets } from '../Onglets';
import { useReseau } from '../reseau/useReseau';
import { BoutonFermer } from '../arrivee/MiniTest';

const TYPES_ACTIVITES = [
  { cle: 'mission', couleur: palette.emeraude[500], cleI18n: 'profil.legendeMission' },
  { cle: 'cours', couleur: palette.lilas[400], cleI18n: 'profil.legendeCours' },
  { cle: 'exercice', couleur: palette.orange[400], cleI18n: 'profil.legendeExercice' },
  { cle: 'annale', couleur: palette.soleil[400], cleI18n: 'profil.legendeAnnale' },
  { cle: 'quiz', couleur: palette.bleu[400], cleI18n: 'profil.legendeQuiz' },
] as const;

function extraireSegments(repartition?: { mission: number; cours: number; exercice: number; annale: number; quiz: number }) {
  if (!repartition) return [{ cle: 'mission', s: 1, couleur: palette.emeraude[500] }];
  const liste = [
    { cle: 'mission', s: repartition.mission, couleur: palette.emeraude[500] },
    { cle: 'cours', s: repartition.cours, couleur: palette.lilas[400] },
    { cle: 'exercice', s: repartition.exercice, couleur: palette.orange[400] },
    { cle: 'annale', s: repartition.annale, couleur: palette.soleil[400] },
    { cle: 'quiz', s: repartition.quiz, couleur: palette.bleu[400] },
  ].filter((item) => item.s > 0);
  return liste.length > 0 ? liste : [{ cle: 'mission', s: 1, couleur: palette.emeraude[500] }];
}

function LegendeActivites() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  return (
    <View style={[styles.legendeConteneur, { borderTopColor: theme.bord.doux }]}>
      {TYPES_ACTIVITES.map((item) => (
        <View key={item.cle} style={styles.legendeItem}>
          <View style={[styles.legendePastille, { backgroundColor: item.couleur, borderColor: theme.bord.fort }]} />
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t(item.cleI18n as never)}</Text>
        </View>
      ))}
    </View>
  );
}

const HAUTEUR_MAX = 96;

/** Couleur de la matière d'après son nom ; sinon une couleur de secours, jamais de barre blanche. */
export function couleurMatiere(nom: string, rang: number): string {
  const n = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (n.includes('math')) return couleursMatiere.maths;
  if (n.includes('phys') || n.includes('chim')) return couleursMatiere.physique;
  if (n.includes('svt') || n.includes('vie') || n.includes('biolog')) return couleursMatiere.svt;
  if (n.includes('fran') || n.includes('lettre')) return couleursMatiere.francais;
  if (n.includes('angl')) return couleursMatiere.anglais;
  if (n.includes('hist') || n.includes('geo')) return couleursMatiere.histoireGeo;
  if (n.includes('philo')) return couleursMatiere.philo;
  return matiereSecours[rang % matiereSecours.length];
}

/** C5 · Ma progression (M4-04) : minutes de la semaine par jour, puis le niveau par matière sur 30 jours, et onglet général avec cumul par mois. */
export function Progression() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [passagesState, setPassagesState] = useState<Passage[]>([]);
  const [activitesState, setActivitesState] = useState<Record<string, ActiviteJour>>({});
  const [onglet, setOnglet] = useState<'semaine' | 'general'>('semaine');
  const [annee, setAnnee] = useState<number>(new Date().getFullYear());
  const [erreur, setErreur] = useState(false);
  const { estEnLigne } = useReseau();

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      Promise.all([lirePassages(getSupabase()), lireActivitesJours()])
        .then(([p, act]) => {
          if (!actif) return;
          setErreur(false);
          setPassagesState(p);
          setActivitesState(act);
          setDonnees(calculerProgression(p, undefined, act, { anneeChoisie: annee }));
        })
        .catch(() => actif && setErreur(true));
      return () => {
        actif = false;
      };
    }, [annee]),
  );

  const changerAnnee = (nouvelleAnnee: number) => {
    setAnnee(nouvelleAnnee);
    setDonnees(calculerProgression(passagesState, undefined, activitesState, { anneeChoisie: nouvelleAnnee }));
  };

  const initiales = t('profil.initiales').split(',');
  const maxMinutes = Math.max(1, ...(donnees?.semaine.map((j) => j.minutes) ?? [1]));
  const maxMinutesMois = Math.max(1, ...(donnees?.globale?.mois.map((m) => m.minutes) ?? [1]));
  const aucune = donnees && donnees.minutesSemaine === 0 && donnees.matieres.length === 0 && (donnees.globale?.minutesTotal ?? 0) === 0;

  return (
    <Ecran
      entete={
        <>
          <BoutonFermer petit icone="chevron-back" libelle={t('reglages.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/moi'))} />
          <Text accessibilityRole="header" style={[typo.texteFort, { color: theme.texte.principal }]}>{t('profil.progression')}</Text>
        </>
      }
    >
      {erreur && !donnees ? <Banniere ton="erreur" titre={t('profil.horsLigne')} /> : null}
      {aucune ? <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('profil.sansMission')}</Text> : null}
      {donnees ? (
        <>
          <View style={styles.onglets}>
            <Onglets
              valeurs={[
                { valeur: 'semaine', libelle: t('profil.cetteSemaine') },
                { valeur: 'general', libelle: t('profil.general') },
              ]}
              valeur={onglet}
              onChange={setOnglet}
            />
          </View>

          {onglet === 'semaine' ? (
            <>
              <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                <View style={styles.ligne}>
                  <Text style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{t('profil.cetteSemaine')}</Text>
                  <Text style={[typo.donnee, { color: theme.texte.secondaire }]}>{t('profil.minutes', { n: donnees.minutesSemaine })}</Text>
                </View>
                <View testID="progression-semaine" style={styles.barres}>
                  {donnees.semaine.map((j, i) => {
                    const segments = extraireSegments(j.repartition);
                    return (
                      <View key={j.jour} style={styles.colonne}>
                        <View style={styles.zoneBarre}>
                          <View
                            testID={`barre-${i}`}
                            accessibilityLabel={`${initiales[i]} : ${t('profil.minutes', { n: j.minutes })}`}
                            style={[
                              styles.barre,
                              j.minutes > 0
                                ? {
                                    height: Math.max(6, (j.minutes / maxMinutes) * HAUTEUR_MAX),
                                    borderColor: theme.bord.fort,
                                    overflow: 'hidden',
                                  }
                                : { height: 3, backgroundColor: theme.bord.doux, borderColor: theme.bord.doux },
                            ]}
                          >
                            {j.minutes > 0
                              ? segments.map((s) => (
                                  <View key={s.cle} style={{ flex: s.s, backgroundColor: s.couleur }} />
                                ))
                              : null}
                          </View>
                        </View>
                        <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{initiales[i]}</Text>
                      </View>
                    );
                  })}
                </View>
                <LegendeActivites />
              </View>

              <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('profil.niveauParMatiere')}</Text>
                {!estEnLigne ? (
                  // Le niveau par matière se calcule avec les missions du compte : il n'est pas affiché hors ligne.
                  <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('profil.niveauHorsLigne')}</Text>
                ) : donnees.matieres.length ? (
                  donnees.matieres.map((m, i) => (
                    <View key={m.matiere} style={styles.matiere}>
                      <View style={styles.ligne}>
                        <Text style={[typo.petit, styles.flex, { color: theme.texte.principal }]}>{m.matiere}</Text>
                        <Text style={[typo.donnee, { color: theme.texte.secondaire }]}>{m.pourcentage} %</Text>
                      </View>
                      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: m.pourcentage }} style={[styles.rail, { borderColor: theme.bord.fort, backgroundColor: theme.fond.creux }]}>
                        <View style={{ width: `${m.pourcentage}%`, height: '100%', backgroundColor: couleurMatiere(m.matiere, i) }} />
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('profil.sansMatiere')}</Text>
                )}
              </View>
            </>
          ) : (
            <>
              {donnees.globale?.anneesDisponibles && donnees.globale.anneesDisponibles.length > 1 ? (
                <View style={styles.selecteurAnnee}>
                  {donnees.globale.anneesDisponibles.map((a) => (
                    <Appui
                      key={a}
                      accessibilityRole="button"
                      accessibilityLabel={`Année ${a}`}
                      onPress={() => changerAnnee(a)}
                      decalage={0}
                      rayon={rayon.s}
                      style={[
                        styles.pastilleAnnee,
                        {
                          backgroundColor: annee === a ? theme.fond.inverse : theme.fond.surface,
                          borderColor: theme.bord.fort,
                        },
                      ]}
                    >
                      <Text style={[typo.boutonPetit, { color: annee === a ? theme.texte.inverse : theme.texte.principal }]}>
                        {a}
                      </Text>
                    </Appui>
                  ))}
                </View>
              ) : null}

              <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('profil.tempsGlobal')}</Text>
                <Text style={[typo.affiche, { color: theme.texte.principal }]}>
                  {t('profil.heuresMinutes', {
                    h: Math.floor((donnees.globale?.minutesTotal ?? 0) / 60),
                    m: (donnees.globale?.minutesTotal ?? 0) % 60,
                  })}
                </Text>
                <View style={[styles.kpis, { borderTopColor: theme.bord.doux }]}>
                  <View style={styles.kpi}>
                    <Text style={[typo.h3, { color: theme.texte.principal }]}>{donnees.globale?.totalLecons ?? 0}</Text>
                    <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('profil.totalLecons')}</Text>
                  </View>
                  <View style={styles.kpi}>
                    <Text style={[typo.h3, { color: theme.texte.principal }]}>{donnees.globale?.totalExercices ?? 0}</Text>
                    <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('profil.totalExercices')}</Text>
                  </View>
                  <View style={styles.kpi}>
                    <Text style={[typo.h3, { color: theme.texte.principal }]}>{donnees.globale?.totalQuiz ?? 0}</Text>
                    <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('profil.totalQuiz')}</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                <View style={styles.ligne}>
                  <Text style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{t('profil.tempsParMois')}</Text>
                  <Text style={[typo.donnee, { color: theme.texte.secondaire }]}>{annee}</Text>
                </View>
                <View testID="progression-mois" style={styles.barresMois}>
                  {donnees.globale?.mois.map((m) => {
                    const segments = extraireSegments(m.repartition);
                    return (
                      <View key={m.mois} style={styles.colonneMois}>
                        <View style={styles.zoneBarre}>
                          <View
                            accessibilityLabel={`${m.libelle} : ${t('profil.minutes', { n: m.minutes })}`}
                            style={[
                              styles.barreMois,
                              m.minutes > 0
                                ? {
                                    height: Math.max(6, (m.minutes / maxMinutesMois) * HAUTEUR_MAX),
                                    borderColor: theme.bord.fort,
                                    overflow: 'hidden',
                                  }
                                : { height: 3, backgroundColor: theme.bord.doux, borderColor: theme.bord.doux },
                            ]}
                          >
                            {m.minutes > 0
                              ? segments.map((s) => (
                                  <View key={s.cle} style={{ flex: s.s, backgroundColor: s.couleur }} />
                                ))
                              : null}
                          </View>
                        </View>
                        <Text numberOfLines={1} style={[typo.legende, styles.etiquetteMois, { color: theme.texte.secondaire }]}>
                          {m.libelle}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <LegendeActivites />
              </View>
            </>
          )}
        </>
      ) : null}
      <CarteListe
        gauche={<PastilleType type="video" />}
        titre={t('videos.mesVideos')}
        sousTitre={t('videos.mesVideosSousTitre')}
        onPress={() => router.push('/mes-videos')}
      />
    </Ecran>
  );
}

const styles = StyleSheet.create({
  onglets: { marginBottom: espace[4] },
  flex: { flex: 1 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  carte: { gap: espace[4], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l, marginBottom: ombre.carte },
  barres: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: espace[3] },
  colonne: { flex: 1, alignItems: 'center', gap: espace[2] },
  zoneBarre: { height: HAUTEUR_MAX, justifyContent: 'flex-end', alignSelf: 'stretch', alignItems: 'center' },
  barre: { width: 22, borderWidth: bord.fin, borderRadius: rayon.s },
  barresMois: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2 },
  colonneMois: { flex: 1, alignItems: 'center', gap: espace[1] },
  barreMois: { width: '80%', minWidth: 12, borderWidth: bord.fin, borderRadius: rayon.s },
  etiquetteMois: { fontSize: 10, textAlign: 'center' },
  selecteurAnnee: { flexDirection: 'row', gap: espace[2], marginBottom: espace[3] },
  pastilleAnnee: { paddingHorizontal: espace[3], paddingVertical: espace[2], borderWidth: bord.normal, borderRadius: rayon.s },
  kpis: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: espace[3], borderTopWidth: bord.fin },
  kpi: { alignItems: 'center', gap: 2 },
  matiere: { gap: espace[2] },
  rail: { height: 8, borderWidth: bord.fin, borderRadius: rayon.pilule, overflow: 'hidden' },
  legendeConteneur: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: espace[3],
    paddingTop: espace[3],
    borderTopWidth: bord.fin,
    marginTop: espace[2],
  },
  legendeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espace[1],
  },
  legendePastille: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: bord.fin,
  },
});
