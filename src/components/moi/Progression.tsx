import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { calculerProgression, lirePassages, type Progression as Donnees } from '@/services/progression';
import { getSupabase } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, matiere as couleursMatiere, matiereSecours, ombre, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Ecran } from '../Ecran';
import { useReseau } from '../reseau/useReseau';
import { BoutonFermer } from '../arrivee/MiniTest';

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

/** C5 · Ma progression (M4-04) : minutes de la semaine par jour, puis le niveau par matière sur 30 jours. */
export function Progression() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState(false);
  const { estEnLigne } = useReseau();

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      lirePassages(getSupabase())
        .then((p) => {
          if (!actif) return;
          setErreur(false);
          setDonnees(calculerProgression(p));
        })
        .catch(() => actif && setErreur(true));
      return () => {
        actif = false;
      };
    }, []),
  );

  const initiales = t('profil.initiales').split(',');
  const maxMinutes = Math.max(1, ...(donnees?.semaine.map((j) => j.minutes) ?? [1]));
  const aucune = donnees && donnees.minutesSemaine === 0 && donnees.matieres.length === 0;

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
          <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            <View style={styles.ligne}>
              <Text style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{t('profil.cetteSemaine')}</Text>
              <Text style={[typo.donnee, { color: theme.texte.secondaire }]}>{t('profil.minutes', { n: donnees.minutesSemaine })}</Text>
            </View>
            <View testID="progression-semaine" style={styles.barres}>
              {donnees.semaine.map((j, i) => (
                <View key={j.jour} style={styles.colonne}>
                  <View style={styles.zoneBarre}>
                    <View
                      testID={`barre-${i}`}
                      accessibilityLabel={`${initiales[i]} : ${t('profil.minutes', { n: j.minutes })}`}
                      style={[styles.barre, j.minutes > 0 ? { height: Math.max(6, (j.minutes / maxMinutes) * HAUTEUR_MAX), backgroundColor: theme.marque.principale, borderColor: theme.bord.fort } : { height: 3, backgroundColor: theme.bord.doux, borderColor: theme.bord.doux }]}
                    />
                  </View>
                  <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{initiales[i]}</Text>
                </View>
              ))}
            </View>
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
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  carte: { gap: espace[4], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l, marginBottom: ombre.carte },
  barres: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: espace[3] },
  colonne: { flex: 1, alignItems: 'center', gap: espace[2] },
  zoneBarre: { height: HAUTEUR_MAX, justifyContent: 'flex-end', alignSelf: 'stretch', alignItems: 'center' },
  barre: { width: 22, borderWidth: bord.fin, borderRadius: rayon.s },
  matiere: { gap: espace[2] },
  rail: { height: 8, borderWidth: bord.fin, borderRadius: rayon.pilule, overflow: 'hidden' },
});
