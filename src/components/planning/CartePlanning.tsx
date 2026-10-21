import { useFocusEffect, router } from 'expo-router';
import { CalendarCheck, ChevronRight } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { planningEstTermine, annonceRepos, prochaineSeance, dateDuJour, localeDe, jourLocalTexte, lirePlanning, progressionSeance, seanceDe, seanceTerminee, type AcquisesEntrainement, type LeconsValidees, type Planning  } from '@/services/planning';
import { lireExercicesFaits, lireMeilleursScores } from '@/services/entrainement';
import { lireLues } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Carte } from '../Carte';

/**
 * Carte « Mon planning » de l'accueil (spec `docs/maquettes/planning-etudes.md` §1) : la séance du jour, ou « Choisis ton
 * temps par jour ». Montée seulement quand l'élève a une date à venir (comme le compte à rebours). Une erreur ou l'absence
 * de date cible cache la carte : l'accueil ne montre jamais d'erreur pour elle.
 */
export function CartePlanning({ idUtilisateur }: { idUtilisateur: string }) {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const [planning, setPlanning] = useState<Planning | null>(null);
  const [lues, setLues] = useState<LeconsValidees>({});
  const [acquises, setAcquises] = useState<AcquisesEntrainement>({});

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      lireLues()
        .catch(() => ({}) as LeconsValidees)
        .then((validees) => actif && setLues(validees));
      Promise.all([
        lireMeilleursScores().catch(() => ({}) as Record<string, number>),
        lireExercicesFaits().catch(() => ({}) as Record<string, true>),
      ]).then(([scores, exercices]) => actif && setAcquises({ scores, exercices }));
      lirePlanning(getSupabase(), idUtilisateur)
        .then(({ planning: p }) => actif && setPlanning(p))
        .catch(() => actif && setPlanning(null));
      return () => {
        actif = false;
      };
    }, [idUtilisateur]),
  );

  if (!planning || planning.statut === 'no_target') return null;

  const aujourdhui = jourLocalTexte();
  const seance = planning.statut === 'ready' ? seanceDe(planning, aujourdhui) : null;
  const progression = seance ? progressionSeance(seance, lues, acquises) : null;
  const termine = planning.statut === 'ready' && planningEstTermine(planning, aujourdhui);
  const sousTitre =
    termine
      ? t('planning.carte.termine')
      : planning.statut !== 'ready'
        ? t('planning.carte.choisir')
      : seance && seanceTerminee(seance, lues, acquises)
        ? t('planning.carte.fait')
        : seance
          ? t(seance.elements.length === 1 ? 'planning.carte.tache' : 'planning.carte.taches', {
              n: seance.elements.length,
              minutes: seance.minutes,
            })
          : annonceRepos(planning, aujourdhui)
            ? t('planning.carte.repos', { jour: dateDuJour(prochaineSeance(planning, aujourdhui)!.jour).toLocaleDateString(localeDe(langue), { weekday: 'long', day: 'numeric' }) })
            : t('planning.carte.libre');
  const pourcentage =
    seance && progression && progression.total > 0
      ? Math.round((progression.faits / progression.total) * 100)
      : null;

  return (
    <Appui
      accessibilityRole="button"
      accessibilityLabel={`${t('planning.carte.titre')}. ${sousTitre}`}
      onPress={() => router.push(termine ? { pathname: '/planning/termine', params: { source: 'carte' } } : { pathname: '/planning', params: { source: 'accueil' } })}
      decalage={4}
      rayon={rayon.l}
    >
      <Carte style={styles.carte}>
        <View style={[styles.pastille, { borderColor: theme.bord.fort, backgroundColor: theme.marque.douce }]}>
          <CalendarCheck size={20} strokeWidth={2} color={theme.texte.principal} />
        </View>
        <View style={styles.texte}>
          <Text numberOfLines={1} style={[typo.texteFort, { color: theme.texte.principal }]}>
            {t('planning.carte.titre')}
          </Text>
          <Text numberOfLines={2} style={[typo.petit, { color: theme.texte.secondaire }]}>
            {sousTitre}
          </Text>
          {pourcentage !== null ? (
            <View
              testID="carte-planning-progression"
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: pourcentage }}
              style={[styles.piste, { borderColor: theme.bord.fort, backgroundColor: theme.fond.creux }]}
            >
              <View
                style={[
                  styles.remplissage,
                  { width: `${pourcentage}%`, backgroundColor: theme.marque.principale },
                ]}
              />
            </View>
          ) : null}
        </View>
        <View style={styles.chevron}>
          <ChevronRight size={20} strokeWidth={2} color={theme.texte.secondaire} />
        </View>
      </Carte>
    </Appui>
  );
}

const styles = StyleSheet.create({
  carte: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espace[3],
    paddingVertical: espace[3],
    paddingHorizontal: espace[4],
  },
  pastille: {
    width: 36,
    height: 36,
    borderWidth: bord.normal,
    borderRadius: rayon.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texte: { flex: 1, gap: espace[1] },
  piste: {
    height: 10,
    marginTop: espace[3],
    borderWidth: bord.fin,
    borderRadius: rayon.pilule,
    overflow: 'hidden',
  },
  remplissage: { height: '100%' },
  chevron: { alignSelf: 'center' },
});
