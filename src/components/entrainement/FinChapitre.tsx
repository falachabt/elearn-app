import { Ionicons } from '@expo/vector-icons';
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
import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { Rebond } from '../Rebond';
import { BoutonFermer } from '../arrivee/MiniTest';
import { decrireCompteur } from './compter';
import { Ligne } from './Ligne';

type Etat = { lecons: number; validees: number; quiz: QuizLibre[]; exercices: Exercice[] };

/** Fin de chapitre (M5-11) : après la dernière leçon, les leçons validées puis le quiz et les exercices du chapitre. */
export function FinChapitre() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { cours, nom } = useLocalSearchParams<{ cours: string; nom?: string }>();
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

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser'));
  if (!etat) return <Ecran>{null}</Ecran>;
  const complet = etat.lecons > 0 && etat.validees === etat.lecons;
  const premierQuiz = etat.quiz[0];
  const pied = (
    <View style={styles.pied}>
      {premierQuiz ? <Bouton libelle={t('entrainement.faireQuiz')} onPress={() => router.push({ pathname: '/entrainement/quiz', params: { id: premierQuiz.id } })} retour /> : null}
      <Bouton variante={premierQuiz ? 'secondaire' : undefined} libelle={t('entrainement.retourChapitre')} onPress={retour} />
    </View>
  );

  return (
    <Ecran pied={pied} entete={<BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />}>
      <Apparition>
        <View style={styles.resultat}>
          <Rebond declencheur={1} echelle={1.08} moment={complet ? 'celebrate' : 'success'}>
            <View style={[styles.pastille, { backgroundColor: complet ? theme.marque.principale : theme.accent.soleil, borderColor: theme.bord.fort }]}>
              <Ionicons name={complet ? 'checkmark' : 'book-outline'} size={34} color={theme.texte.surCouleur} />
            </View>
          </Rebond>
          <Text accessibilityRole="header" style={[typo.h1, styles.centre, { color: theme.texte.principal }]}>{t(complet ? 'entrainement.finTitre' : 'entrainement.finTitrePartiel')}</Text>
          <Text style={[typo.texte, styles.centre, { color: theme.texte.secondaire }]}>
            {[nom || null, etat.lecons ? t('entrainement.finLecons', { n: etat.validees, total: etat.lecons }) : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </Apparition>
      {!complet && etat.lecons ? <Banniere ton="info" titre={t('entrainement.finAValider')} /> : null}
      {etat.quiz.length || etat.exercices.length ? (
        <View style={styles.groupe}>
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('entrainement.vaPlusLoin')}</Text>
          {etat.quiz.map((q) => (
            <Ligne key={q.id} icone="help-circle-outline" titre={q.nom} details={t('entrainement.questions', { n: q.questions })} onPress={() => router.push({ pathname: '/entrainement/quiz', params: { id: q.id } })} />
          ))}
          {etat.exercices.length ? (
            <Ligne
              icone="create-outline"
              titre={t('entrainement.exercices')}
              details={decrireCompteur(t, { quiz: 0, exercices: etat.exercices.length })}
              onPress={() => router.push({ pathname: '/entrainement/chapitre', params: { cours: String(cours), nom: nom ?? '' } })}
            />
          ) : null}
        </View>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  resultat: { alignItems: 'center', gap: espace[4], marginTop: espace[7] },
  pastille: { width: 72, height: 72, borderRadius: rayon.pilule, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  centre: { textAlign: 'center' },
  groupe: { gap: espace[4] },
  pied: { gap: espace[3] },
});
