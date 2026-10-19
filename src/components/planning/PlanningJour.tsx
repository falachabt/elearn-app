import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Check, ChevronRight } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { estErreurReseau } from '@/services/connectivite';
import { lireExercicesFaits, lireMeilleursScores } from '@/services/entrainement';
import {
  avecSeanceFaite,
  cocherSeance,
  dateDuJour,
  elementFait,
  lirePlanning,
  localeDe,
  progressionSeance,
  seanceDe,
  seanceTerminee,
  type AcquisesEntrainement,
  type ElementSeance,
  type LeconsValidees,
  type Planning,
} from '@/services/planning';
import { lireLues } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { BoutonFermer } from '../arrivee/MiniTest';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { EcranErreur } from '../liste/EcranErreur';
import { Pastille } from '../liste/Pastille';
import { PastilleType, type TypeContenu } from '../liste/PastilleType';
import { Squelettes } from '../liste/Squelettes';
import { CLES_PHASE, titreElement } from './Planning';

type Etat = { type: 'chargement' } | { type: 'pret'; planning: Planning; copie: boolean } | { type: 'erreur' } | { type: 'pasReseau' };

const TYPE_PASTILLE: Record<ElementSeance['genre'], TypeContenu> = {
  lecon: 'lecon',
  quiz: 'quiz',
  exercice: 'exercice',
  annales: 'annale',
  revisionFinale: 'lecon',
  revisionLibre: 'lecon',
};
const CLES_DETAIL = {
  annales: 'planning.detail.annales',
  revisionFinale: 'planning.detail.revisionFinale',
  revisionLibre: 'planning.detail.revisionLibre',
} as const;

const jourValide = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

/** Ouvre la tâche : leçon, quiz, exercice ou dossier d'annales correspondant, sinon l'onglet Réviser. */
function ouvrir(e: ElementSeance) {
  suivre('planning_task_opened', { genre: e.genre });
  if (e.genre === 'lecon') {
    router.push({ pathname: '/cours/lecon', params: { id: String(e.leconId), cours: String(e.coursId), matiere: e.matiere ?? '' } });
    return;
  }
  if (e.genre === 'quiz') {
    router.push({ pathname: '/entrainement/quiz', params: { id: e.quizId, cours: String(e.coursId), nom: e.cours } });
    return;
  }
  if (e.genre === 'exercice') {
    router.push({ pathname: '/entrainement/exercice', params: { id: e.exerciceId, cours: String(e.coursId) } });
    return;
  }
  if (e.genre === 'annales' && e.dossierId) {
    router.push({ pathname: '/annales/dossier', params: { id: e.dossierId, titre: e.dossier ?? '' } });
    return;
  }
  router.push('/reviser');
}

function Tache({ e, fait }: { e: ElementSeance; fait: boolean }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const typePastille = TYPE_PASTILLE[e.genre];
  const titre = titreElement(e, t);
  const detail =
    e.genre === 'lecon'
      ? `${e.cours}${e.matiere ? ` · ${e.matiere}` : ''} · ${t('planning.minutes', { n: e.minutes })}`
      : e.genre === 'quiz'
        ? `${e.cours}${e.matiere ? ` · ${e.matiere}` : ''} · ${t('planning.detail.quiz', { questions: e.questions, minutes: e.minutes })}`
        : e.genre === 'exercice'
          ? `${e.cours}${e.matiere ? ` · ${e.matiere}` : ''} · ${t('planning.detail.exercice', { minutes: e.minutes })}`
          : e.genre === 'annales' && e.minutes
            ? `${t('planning.detail.annales')} · ${t('planning.minutes', { n: e.minutes })}`
            : t(CLES_DETAIL[e.genre]);
  const aValidationPropre = e.genre === 'lecon' || e.genre === 'quiz' || e.genre === 'exercice';
  return (
    <Appui
      accessibilityRole="button"
      accessibilityLabel={`${t('planning.ouvrirTache', { titre })}${fait ? `. ${t('planning.fait')}` : ''}`}
      onPress={() => ouvrir(e)}
      ombre={fait ? 0 : ombre.carte}
      decalage={fait ? 0 : 2}
      couleurOmbre={theme.ombre}
      rayon={rayon.l}
    >
      <View style={[styles.tache, { borderColor: theme.bord.fort, backgroundColor: fait ? theme.marque.douce : theme.fond.surface }]}>
        <PastilleType type={typePastille} taille={38} />
        <View style={styles.tacheTexte}>
          <Text numberOfLines={2} style={[typo.texteFort, { color: theme.texte.principal }]}>{titre}</Text>
          <Text numberOfLines={2} style={[typo.legende, { color: theme.texte.secondaire }]}>{fait && aValidationPropre ? `${t('planning.jourDeja')} · ${detail}` : detail}</Text>
        </View>
        {fait ? <Pastille texte={t('planning.fait')} vert /> : <ChevronRight size={22} strokeWidth={2} color={theme.texte.secondaire} />}
      </View>
    </Appui>
  );
}

/**
 * Page d'une séance (spec `docs/maquettes/planning-etudes.md` §3.7) : les tâches du jour (leçons, quiz, exercices, annales),
 * chacune ouvre sa ressource. Une tâche déjà validée compte comme faite ; une séance entièrement validée se coche toute seule.
 */
export function PlanningJour() {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ jour?: string }>();
  const jour = jourValide(params.jour);
  const utilisateur = useSessionPrete();
  const [etat, setEtat] = useState<Etat>({ type: 'chargement' });
  const [lues, setLues] = useState<LeconsValidees>({});
  const [acquises, setAcquises] = useState<AcquisesEntrainement>({});
  const [erreurCocher, setErreurCocher] = useState(false);

  const charger = useCallback(() => {
    if (utilisateur === null) return undefined;
    let actif = true;
    void (async () => {
      try {
        const [validees, scores, exercices] = await Promise.all([
          lireLues().catch(() => ({}) as LeconsValidees),
          lireMeilleursScores().catch(() => ({}) as Record<string, number>),
          lireExercicesFaits().catch(() => ({}) as Record<string, true>),
        ]);
        const acq: AcquisesEntrainement = { scores, exercices };
        if (actif) {
          setLues(validees);
          setAcquises(acq);
        }
        const lu = await lirePlanning(getSupabase(), utilisateur);
        if (!actif) return;
        let planning = lu.planning;
        // Toutes les tâches de la séance sont déjà validées : la séance est cochée sans attendre l'élève.
        const seance = jour ? seanceDe(planning, jour) : null;
        if (jour && seance && !seance.fait && !lu.copie && seanceTerminee(seance, validees, acq)) {
          planning = avecSeanceFaite(planning, jour, true);
          cocherSeance(getSupabase(), jour, true).catch(() => undefined);
        }
        setEtat({ type: 'pret', planning, copie: lu.copie });
      } catch (e) {
        if (actif) setEtat({ type: estErreurReseau(e) ? 'pasReseau' : 'erreur' });
      }
    })();
    return () => {
      actif = false;
    };
  }, [utilisateur, jour]);
  useFocusEffect(useCallback(() => charger(), [charger]));

  const retour = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/planning');
  }, []);

  const seance = etat.type === 'pret' && jour ? seanceDe(etat.planning, jour) : null;
  const copie = etat.type === 'pret' && etat.copie;

  const basculer = async (fait: boolean) => {
    if (etat.type !== 'pret' || etat.copie || !jour) return;
    const avant = etat.planning;
    setErreurCocher(false);
    setEtat({ ...etat, planning: avecSeanceFaite(avant, jour, fait) });
    try {
      if (!(await cocherSeance(getSupabase(), jour, fait))) throw new Error('jour_inconnu');
      suivre('planning_day_checked', { fait });
    } catch {
      setEtat((courant) => (courant.type === 'pret' ? { ...courant, planning: avant } : courant));
      setErreurCocher(true);
    }
  };

  const titre = jour ? dateDuJour(jour).toLocaleDateString(localeDe(langue), { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  const entete = (
    <View style={styles.entete}>
      <BoutonFermer icone="chevron-back" libelle={t('planning.retour')} onPress={retour} />
      <Text numberOfLines={1} style={[typo.etiquette, styles.enteteTitre, { color: theme.texte.secondaire }]}>{t('planning.etiquette').toUpperCase()}</Text>
    </View>
  );

  if (etat.type === 'chargement') return <Ecran entete={entete}><Squelettes nombre={3} /></Ecran>;
  if (etat.type === 'erreur' || etat.type === 'pasReseau') {
    return (
      <Ecran entete={entete}>
        <EcranErreur titre={t(etat.type === 'erreur' ? 'planning.erreurTitre' : 'planning.horsLigneTitre')} phrase={t(etat.type === 'erreur' ? 'planning.erreurTexte' : 'planning.horsLigneTexte')} reessayer={t('planning.reessayer')} onReessayer={() => { setEtat({ type: 'chargement' }); charger(); }} />
      </Ecran>
    );
  }
  if (!seance || !jour) {
    return (
      <Ecran entete={entete}>
        <View style={styles.bloc}>
          <Text accessibilityRole="header" style={[typo.affiche, { color: theme.texte.principal }]}>{t('planning.jourAbsent')}</Text>
          <Bouton variante="secondaire" libelle={t('planning.retourPlanning')} onPress={retour} />
        </View>
      </Ecran>
    );
  }

  const terminee = seanceTerminee(seance, lues, acquises);
  const progression = progressionSeance(seance, lues, acquises);
  // Une séance cochée par les tâches validées seules ne se décoche pas à la main : elle se recocherait aussitôt.
  const seulementAcquises = seance.elements.length > 0 && seance.elements.every((e) => elementFait(e, lues, acquises));
  const pied = terminee ? undefined : <Bouton libelle={t('planning.terminer')} desactive={copie} onPress={() => void basculer(true)} />;
  return (
    <Ecran entete={entete} pied={pied}>
      <View style={styles.contenu}>
        <View style={styles.bloc}>
          <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{`${t(CLES_PHASE[seance.phase])} · ${t('planning.minutes', { n: seance.minutes })}`.toUpperCase()}</Text>
          <Text accessibilityRole="header" style={[typo.affiche, { color: theme.texte.principal }]}>{titre.charAt(0).toUpperCase() + titre.slice(1)}</Text>
          <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('planning.progression', progression)}</Text>
        </View>
        {terminee ? (
          <View style={[styles.bravo, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }]}>
            <Check size={22} strokeWidth={2.5} color={theme.texte.surCouleur} />
            <Text style={[typo.h3, styles.bravoTexte, { color: theme.texte.surCouleur }]}>{t('planning.terminee')}</Text>
          </View>
        ) : null}
        <View style={styles.bloc}>
          {(seance.elements.length > 0 ? seance.elements : [{ genre: 'revisionLibre' } as ElementSeance]).map((e, i) => (
            <Tache key={i} e={e} fait={seance.fait || elementFait(e, lues, acquises)} />
          ))}
        </View>
        {erreurCocher ? <Text accessibilityRole="alert" style={[typo.petit, { color: theme.etat.erreur }]}>{t('planning.erreurCocher')}</Text> : null}
        {terminee && seance.fait && !seulementAcquises ? <Bouton variante="texte" libelle={t('planning.rouvrir')} desactive={copie} onPress={() => void basculer(false)} /> : null}
        {terminee ? <Bouton variante="secondaire" libelle={t('planning.retourPlanning')} onPress={retour} /> : null}
      </View>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  entete: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  enteteTitre: { flex: 1 },
  contenu: { gap: espace[5], paddingBottom: espace[7] },
  bloc: { gap: espace[3] },
  tache: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: espace[3], paddingHorizontal: espace[4], paddingVertical: espace[3], borderWidth: bord.normal, borderRadius: rayon.l },
  pastille: { width: cibleMin - 8, height: cibleMin - 8, borderWidth: bord.normal, borderRadius: rayon.m, alignItems: 'center', justifyContent: 'center' },
  tacheTexte: { flex: 1, gap: espace[1] },
  bravo: { flexDirection: 'row', alignItems: 'center', gap: espace[3], padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.l },
  bravoTexte: { flex: 1 },
});
