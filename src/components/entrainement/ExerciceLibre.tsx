import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { basculerExerciceFait, lireEntrainement, lireExercice, lireExercicesFaits, type DetailExercice, type Exercice } from '@/services/entrainement';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';
import { Blocs } from '../reviser/Blocs';

type Etat = { statut: 'chargement' } | { statut: 'erreur' } | { statut: 'pret'; exercices: Exercice[]; faits: Record<string, true>; detail: DetailExercice | null };

/** Un exercice du chapitre (M5-09) : l'énoncé, puis « fait » ; l'exercice suivant enchaîne sans repasser par la liste. */
export function ExerciceLibre() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { id, cours } = useLocalSearchParams<{ id: string; cours: string }>();
  const [etat, setEtat] = useState<Etat>({ statut: 'chargement' });
  const [corrige, setCorrige] = useState(false);
  const pret = useSessionPrete();

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    Promise.all([lireEntrainement(getSupabase(), Number(cours)), lireExercicesFaits()])
      .then(async ([e, faits]) => {
        const resume = e.exercices.find((x) => x.id === id);
        // Sans le détail (ancienne base, hors ligne jamais ouvert), l'énoncé court de la liste suffit.
        const detail = resume ? await lireExercice(getSupabase(), resume.id, resume.enonce).catch(() => null) : null;
        if (actif) setEtat({ statut: 'pret', exercices: e.exercices, faits, detail });
      })
      .catch(() => actif && setEtat({ statut: 'erreur' }));
    return () => {
      actif = false;
    };
  }, [cours, id, pret]);

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
          {etat.detail?.contexte.length ? <Blocs blocs={etat.detail.contexte} /> : null}
          <View style={[styles.enonce, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
            {etat.detail?.enonce.length ? <Blocs blocs={etat.detail.enonce} /> : <Text selectable style={[typo.texte, { color: theme.texte.principal }]}>{exercice.enonce}</Text>}
          </View>
          {etat.detail?.corrige.length ? (
            corrige ? (
              <View style={styles.corrige}>
                <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('entrainement.corrige')}</Text>
                <Blocs blocs={etat.detail.corrige} />
              </View>
            ) : (
              <Bouton variante="secondaire" libelle={t('entrainement.voirCorrige')} onPress={() => setCorrige(true)} />
            )
          ) : (
            <Banniere ton="info" titre={t('entrainement.pasDeCorrige')} />
          )}
        </>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  pied: { gap: espace[3] },
  enonce: { padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
  corrige: { gap: espace[4] },
});
