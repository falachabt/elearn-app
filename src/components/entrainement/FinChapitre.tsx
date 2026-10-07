import { BookOpen, Check } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { lireEntrainement, noterFinChapitreVue, type Exercice, type QuizLibre } from '@/services/entrainement';
import { lireLecons, lireLues } from '@/services/reviser';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Apparition } from '../Apparition';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { PropositionNotifications } from '../PropositionNotifications';
import { Rebond } from '../Rebond';
import { BoutonFermer } from '../arrivee/MiniTest';
import { CarteListe } from '../liste/CarteListe';
import { PastilleType } from '../liste/PastilleType';
import { versListeChapitres } from '../reviser/versListeChapitres';

type Etat = { lecons: number; validees: number; quiz: QuizLibre[]; exercices: Exercice[] };

/** Fin de chapitre (M5-11, revue design écran 6) : écran centré, deux cartes Quiz et Exercices, « S'entraîner sur ce chapitre ». */
export function FinChapitre() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { cours, nom, matiere } = useLocalSearchParams<{ cours: string; nom?: string; matiere?: string }>();
  const [etat, setEtat] = useState<Etat | null>(null);
  const pret = useSessionPrete();

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    void (async () => {
      const id = Number(cours);
      const [lecons, lues, entrainement] = await Promise.all([
        lireLecons(getSupabase(), id).catch(() => []),
        lireLues(),
        lireEntrainement(getSupabase(), id).catch(() => ({ quiz: [], exercices: [] })),
      ]);
      const validees = lecons.filter((l) => lues[l.id] !== undefined).length;
      if (lecons.length && validees === lecons.length) await noterFinChapitreVue(id);
      suivre('chapter_end_shown', { complet: !!lecons.length && validees === lecons.length, quiz: entrainement.quiz.length, exercices: entrainement.exercices.length });
      if (actif) setEtat({ lecons: lecons.length, validees, ...entrainement });
    })();
    return () => {
      actif = false;
    };
  }, [cours, pret]);

  // « Retour au chapitre » ramène à la liste des chapitres de la matière, pas à la dernière leçon lue.
  const retour = () => versListeChapitres(matiere);
  if (!etat) return <Ecran>{null}</Ecran>;
  const complet = etat.lecons > 0 && etat.validees === etat.lecons;
  const ouvrir = (onglet?: 'quiz' | 'exercices') => router.push({ pathname: '/entrainement/chapitre', params: { cours: String(cours), nom: nom ?? '', ...(onglet ? { onglet } : {}) } });
  const aEntrainement = etat.quiz.length > 0 || etat.exercices.length > 0;
  const pied = (
    <View style={styles.pied}>
      {aEntrainement ? <Bouton libelle={t('entrainement.ouvrir')} onPress={() => ouvrir()} retour /> : null}
      <Bouton variante={aEntrainement ? 'texte' : undefined} libelle={t(aEntrainement ? 'entrainement.plusTard' : 'entrainement.retourChapitre')} onPress={retour} />
    </View>
  );

  return (
    <>
    <Ecran pied={pied} entete={<BoutonFermer petit icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />}>
      <Apparition>
        <View style={styles.resultat}>
          <Rebond declencheur={1} echelle={1.08} moment={complet ? 'celebrate' : 'success'}>
            <View style={[styles.pastille, { backgroundColor: complet ? theme.marque.principale : theme.accent.soleil, borderColor: theme.bord.fort }]}>
              {complet ? <Check size={36} strokeWidth={3} color={theme.texte.surCouleur} /> : <BookOpen size={32} strokeWidth={2} color={theme.texte.surCouleur} />}
            </View>
          </Rebond>
          <Text accessibilityRole="header" style={[typo.h1, styles.centre, { color: theme.texte.principal }]}>{t(complet ? 'entrainement.finTitre' : 'entrainement.finTitrePartiel')}</Text>
          <Text style={[typo.texte, styles.centre, { color: theme.texte.secondaire }]}>
            {[nom || null, etat.lecons ? t('entrainement.finLecons', { n: etat.validees, total: etat.lecons }) : null].filter(Boolean).join(' · ')}
          </Text>
          {!complet && etat.lecons ? <Text style={[typo.petit, styles.centre, { color: theme.texte.secondaire }]}>{t('entrainement.finAValider')}</Text> : null}
        </View>
      </Apparition>
      {aEntrainement ? (
        <View style={styles.groupe}>
          {etat.quiz.length ? <CarteListe gauche={<PastilleType type="quiz" />} titre={t('entrainement.carteQuiz', { n: etat.quiz.length })} onPress={() => ouvrir('quiz')} /> : null}
          {etat.exercices.length ? <CarteListe gauche={<PastilleType type="exercice" />} titre={t('entrainement.carteExercices', { n: etat.exercices.length })} onPress={() => ouvrir('exercices')} /> : null}
        </View>
      ) : null}
    </Ecran>
    <PropositionNotifications source="fin_chapitre" />
    </>
  );
}

const styles = StyleSheet.create({
  resultat: { alignItems: 'center', gap: espace[4], marginTop: espace[7] },
  pastille: { width: 72, height: 72, borderRadius: rayon.pilule, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  centre: { textAlign: 'center' },
  groupe: { gap: espace[4] },
  pied: { gap: espace[3] },
});
