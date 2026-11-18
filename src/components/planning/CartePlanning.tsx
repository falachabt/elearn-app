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

import { Apparition } from '../Apparition';
import { Appui } from '../Appui';
import { Carte } from '../Carte';
import { construireParcours } from '@/services/parcoursSecondaire';

const OUVRIR_PARCOURS = { pathname: '/reviser', params: { onglet: 'parcours' } } as const;

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

  const parcours = planning.statut === 'ready' ? construireParcours(planning, aujourdhui, lues, acquises) : null;
  const seanceEnCours = !!seance && !termine && !seanceTerminee(seance, lues, acquises) && !!parcours && parcours.totalAujourdhui > 0;

  if (parcours && seanceEnCours) {
    const faits = parcours.faitsAujourdhui;
    const total = parcours.totalAujourdhui;
    const courante = parcours.groupes.find((g) => g.type === 'aujourdhui')?.etapes.find((e) => e.etat === 'courante');
    const titre = faits > 0 && courante?.rang ? t('parcours.accueilContinuer', { n: courante.rang }) : t('parcours.accueilFaire');
    return (
      <Apparition delai={60}>
        <View style={styles.bloc}>
          {parcours.aRefaire > 0 ? (
            <Appui accessibilityRole="button" accessibilityLabel={`${t('parcours.accueilARefaire')}. ${parcours.aRefaire === 1 ? t('parcours.accueilARefaireUn') : t('parcours.accueilARefaireTexte', { n: parcours.aRefaire })}`} onPress={() => router.push(OUVRIR_PARCOURS)} decalage={3} rayon={rayon.l}>
              <View testID="accueil-a-reprendre" style={[styles.reprendre, { backgroundColor: theme.etat.erreurDoux, borderColor: theme.bord.fort }]}>
                <Text style={[typo.etiquette, { color: theme.etat.erreurTexte }]}>{t('parcours.accueilARefaire')}</Text>
                <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{parcours.aRefaire === 1 ? t('parcours.accueilARefaireUn') : t('parcours.accueilARefaireTexte', { n: parcours.aRefaire })}</Text>
              </View>
            </Appui>
          ) : null}
          <Appui accessibilityRole="button" accessibilityLabel={`${t('parcours.accueilTitre')}. ${titre}. ${t('parcours.accueilProgression', { faits, total })}`} onPress={() => router.push(OUVRIR_PARCOURS)} decalage={4} rayon={rayon.l}>
            <View testID="accueil-programme-du-jour" style={[styles.programme, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
              <Text style={[typo.etiquette, { color: theme.texte.principal }]}>{t('parcours.accueilTitre')}</Text>
              <Text style={[typo.h3, { color: theme.texte.principal }]}>{titre}</Text>
              <View
                testID="carte-planning-progression"
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: Math.round((faits / total) * 100) }}
                style={[styles.piste, styles.pisteProgramme, { borderColor: theme.bord.fort, backgroundColor: theme.fond.creux }]}
              >
                <View style={[styles.remplissage, { width: `${Math.round((faits / total) * 100)}%`, backgroundColor: theme.marque.principale }]} />
              </View>
              <Text style={[typo.legende, { color: theme.texte.principal }]}>{t('parcours.accueilProgression', { faits, total })}</Text>
            </View>
          </Appui>
        </View>
      </Apparition>
    );
  }

  return (
    <Apparition delai={60}>
      <Appui
        accessibilityRole="button"
        accessibilityLabel={`${t('planning.carte.titre')}. ${sousTitre}`}
        onPress={() => router.push(termine ? { pathname: '/planning/termine', params: { source: 'carte' } } : OUVRIR_PARCOURS)}
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
    </Apparition>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: espace[3] },
  reprendre: { borderWidth: bord.normal, borderRadius: rayon.l, paddingVertical: espace[3], paddingHorizontal: espace[4], gap: 2 },
  programme: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[4], gap: espace[2] },
  pisteProgramme: { marginTop: espace[1] },
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
