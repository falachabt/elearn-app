import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { basculerExerciceFait, lireEntrainement, lireExercicesFaits, type Exercice } from '@/services/entrainement';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; exercices: Exercice[]; faits: Record<string, true> };

/** Un exercice du chapitre (M5-09) : l'énoncé, puis « fait » ; l'exercice suivant enchaîne sans repasser par la liste. */
export function ExerciceLibre() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { id, cours } = useLocalSearchParams<{ id: string; cours: string }>();
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const pret = useSessionPrete();

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    Promise.all([lireEntrainement(getSupabase(), Number(cours)), lireExercicesFaits()])
      .then(([e, faits]) => actif && setEtat({ statut: 'pret', exercices: e.exercices, faits }))
      .catch(() => actif && setEtat({ statut: 'erreur' }));
    return () => {
      actif = false;
    };
  }, [cours, pret]);

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/reviser'));
  const position = etat.statut === 'pret' ? etat.exercices.findIndex((e) => e.id === id) : -1;
  const exercice = etat.statut === 'pret' ? etat.exercices[position] : undefined;
  const suivant = etat.statut === 'pret' && position >= 0 ? etat.exercices[position + 1] : undefined;
  const fait = etat.statut === 'pret' && !!exercice && !!etat.faits[exercice.id];

  const basculer = async () => {
    if (!exercice || etat.statut !== 'pret') return;
    const maintenant = await basculerExerciceFait(exercice.id);
    suivre('practice_exercise_done', { fait: maintenant });
    setEtat({ ...etat, faits: maintenant ? { ...etat.faits, [exercice.id]: true } : Object.fromEntries(Object.entries(etat.faits).filter(([k]) => k !== exercice.id)) });
  };

  const pied = exercice ? (
    <View style={styles.pied}>
      {suivant ? <Bouton libelle={t('entrainement.exerciceSuivant')} onPress={() => router.replace({ pathname: '/entrainement/exercice', params: { id: suivant.id, cours: String(cours) } })} retour /> : null}
      <Bouton variante={suivant || fait ? 'secondaire' : undefined} libelle={t(fait ? 'entrainement.annulerFait' : 'entrainement.marquerFait')} onPress={() => void basculer()} />
    </View>
  ) : undefined;

  return (
    <Ecran pied={pied} entete={<BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={retour} />}>
      {etat.statut === 'erreur' || (etat.statut === 'pret' && !exercice) ? <Banniere ton="erreur" titre={t('entrainement.exerciceErreur')} /> : null}
      {exercice && etat.statut === 'pret' ? (
        <>
          <Text style={[typo.legende, { color: theme.texte.secondaire }]}>
            {[t('entrainement.exercice', { n: position + 1, total: etat.exercices.length }), fait ? t('entrainement.fait') : null].filter(Boolean).join(' · ')}
          </Text>
          <Text accessibilityRole="header" style={[typo.h2, { color: theme.texte.principal }]}>{exercice.titre}</Text>
          <View style={[styles.enonce, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            <Text selectable style={[typo.texte, { color: theme.texte.principal }]}>{exercice.enonce}</Text>
          </View>
          <Banniere ton="info" titre={t('entrainement.pasDeCorrige')} />
        </>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  pied: { gap: espace[3] },
  enonce: { padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
});
