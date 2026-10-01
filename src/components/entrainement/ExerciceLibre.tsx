import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { basculerExerciceFait, lireEntrainement, lireExercice, lireExercicesFaits, noterDernier, type DetailExercice, type Exercice } from '@/services/entrainement';
import { getSupabase } from '@/services/supabase';
import { titreExercice } from '@/services/titres';
import { useSessionPrete } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';
import { EcranErreur } from '../liste/EcranErreur';
import { PastilleType } from '../liste/PastilleType';
import { Squelettes } from '../liste/Squelettes';
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

  const [essai, setEssai] = useState(0);
  const recharger = () => {
    setEtat({ statut: 'chargement' });
    setEssai((n) => n + 1);
  };

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    Promise.all([lireEntrainement(getSupabase(), Number(cours)), lireExercicesFaits()])
      .then(async ([e, faits]) => {
        const resume = e.exercices.find((x) => x.id === id);
        // Sans le détail (ancienne base, hors ligne jamais ouvert), l'énoncé court de la liste suffit.
        const detail = resume ? await lireExercice(getSupabase(), resume.id, resume.enonce).catch(() => null) : null;
        if (resume) void noterDernier({ type: 'exercice', id: resume.id, cours: Number(cours), chapitre: '' });
        if (actif) setEtat({ statut: 'pret', exercices: e.exercices, faits, detail });
      })
      .catch(() => actif && setEtat({ statut: 'erreur' }));
    return () => {
      actif = false;
    };
  }, [cours, id, pret, essai]);

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
  // Ouvrir le corrigé marque l'exercice « Fait » (revue design, écran 5).
  const voirCorrige = async () => {
    setCorrige(true);
    if (!fait) await basculer();
  };
  const aCorrige = etat.statut === 'pret' && !!etat.detail?.corrige.length;

  const pied = exercice ? (
    <View style={styles.pied}>
      {aCorrige && !corrige ? <Bouton variante="secondaire" libelle={t('entrainement.voirCorrige')} onPress={() => void voirCorrige()} /> : null}
      {!aCorrige ? <Bouton variante="texte" libelle={t(fait ? 'entrainement.annulerFait' : 'entrainement.marquerFait')} onPress={() => void basculer()} /> : null}
      {suivant ? (
        <Bouton libelle={t('entrainement.exerciceSuivant')} onPress={() => router.replace({ pathname: '/entrainement/exercice', params: { id: suivant.id, cours: String(cours) } })} retour />
      ) : (
        <Bouton libelle={t('entrainement.retourChapitre')} onPress={retour} />
      )}
    </View>
  ) : undefined;

  return (
    <Ecran
      pied={pied}
      entete={
        <>
          <BoutonFermer petit libelle={t('entrainement.fermerExercice')} onPress={retour} />
          <Text style={[typo.texteFort, styles.rang, { color: theme.texte.principal }]}>
            {exercice && etat.statut === 'pret' ? t('entrainement.exerciceRang', { n: position + 1, total: etat.exercices.length }) : ''}
          </Text>
          <PastilleType type="exercice" taille={28} />
        </>
      }
    >
      {etat.statut === 'chargement' ? <Squelettes nombre={3} /> : null}
      {etat.statut === 'erreur' || (etat.statut === 'pret' && !exercice) ? (
        <EcranErreur titre={t('entrainement.erreurTitre')} phrase={t('entrainement.exerciceErreur')} reessayer={t('entrainement.reessayer')} onReessayer={recharger} secours={{ libelle: t('entrainement.retourChapitre'), onPress: retour }} />
      ) : null}
      {exercice && etat.statut === 'pret' ? (
        <>
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{titreExercice(exercice.titre, '') || t('entrainement.exerciceN', { n: position + 1 })}</Text>
          {etat.detail?.contexte.length ? (
            <View style={[styles.bloc, { backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}>
              <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('entrainement.contexte')}</Text>
              <Blocs blocs={etat.detail.contexte} />
            </View>
          ) : null}
          {etat.detail?.enonce.length ? <Blocs blocs={etat.detail.enonce} /> : <Text selectable style={[typo.texte, { color: theme.texte.principal }]}>{exercice.enonce}</Text>}
          {aCorrige && corrige && etat.detail ? (
            <View style={[styles.bloc, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
              <Text accessibilityRole="header" style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{t('entrainement.corrige')}</Text>
              <Blocs blocs={etat.detail.corrige} />
            </View>
          ) : null}
          {!aCorrige ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('entrainement.corrigeBientot')}</Text> : null}
        </>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  pied: { gap: espace[3] },
  rang: { flex: 1, textAlign: 'center' },
  bloc: { padding: espace[4], gap: espace[3], borderWidth: bord.normal, borderRadius: rayon.l },
});
