import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { enregistrerCorrection, lireCorrection, statuts, type Correction } from '@/services/correction';
import { libelleAvecPrix, useContenuPayant } from '@/session/useContenuPayant';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { EcranVide } from '../EcranVide';
import { OptionReponse } from '../OptionReponse';
import { BoutonFermer } from '../arrivee/MiniTest';
import { GrilleQuestions } from './GrilleQuestions';

const LETTRES = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Revoir une question d'un quiz terminé (M5-10) : la grille reste en haut pour passer d'une question à l'autre. */
export function RevoirCorrection() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { i } = useLocalSearchParams<{ i?: string }>();
  const [c, setC] = useState<Correction | null | undefined>(undefined);
  const [n, setN] = useState(Number(i) || 0);

  useEffect(() => {
    let actif = true;
    lireCorrection().then((x) => actif && setC(x));
    return () => {
      actif = false;
    };
  }, []);

  const payant = useContenuPayant();
  // L'explication d'une question du serveur ne vient que de depenser_credits (M18-04) ; on la garde avec la correction.
  const voirExplication = async (k: number) => {
    if (!c) return;
    const contenu = await payant.ouvrir<{ explanation?: string | null }>('quiz_explanation', c.questions[k].id);
    const texte = contenu?.explanation?.trim();
    if (!texte) return;
    const suite = { ...c, questions: c.questions.map((x, j) => (j === k ? { ...x, explication: texte } : x)) };
    setC(suite);
    void enregistrerCorrection(suite);
  };

  const retour = () => (router.canGoBack() ? router.back() : router.replace('/'));
  if (c === undefined) return null;
  if (!c || !c.questions.length) return <EcranVide titre={t('correction.vide')} phrase={t('correction.videTexte')} />;

  const total = c.questions.length;
  const q = c.questions[Math.min(n, total - 1)];
  const reponse = c.reponses[n];
  const etat = (k: number) => (k === q.bonne ? 'bonne' : k === reponse ? 'fausse' : 'neutre');
  const pied = (
    <View style={styles.pied}>
      <View style={styles.flex}>
        <Bouton variante="secondaire" libelle={t('correction.precedente')} desactive={n === 0} onPress={() => setN(n - 1)} />
      </View>
      <View style={styles.flex}>
        <Bouton variante="secondaire" libelle={t('correction.suivante')} desactive={n >= total - 1} onPress={() => setN(n + 1)} />
      </View>
    </View>
  );

  return (
    <Ecran
      pied={pied}
      entete={
        <>
          <BoutonFermer icone="chevron-back" libelle={t('correction.retour')} onPress={retour} />
          <Text accessibilityRole="header" style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>{t('correction.titre', { n: n + 1, total })}</Text>
        </>
      }
    >
      <GrilleQuestions statuts={statuts(c)} actuelle={n} onChoisir={setN} />
      {q.libelleMatiere || q.chapitre ? (
        <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{[q.libelleMatiere, q.chapitre].filter(Boolean).join(' · ')}</Text>
      ) : null}
      <Text style={[typo.h3, { color: theme.texte.principal }]}>{q.enonce}</Text>
      {reponse === null || reponse === undefined || reponse < 0 ? <Text style={[typo.petit, { color: theme.etat.erreurTexte }]}>{t('correction.sansReponse')}</Text> : null}
      <View style={styles.options}>
        {q.choix.map((choix, k) => (
          <OptionReponse key={k} lettre={LETTRES[k] ?? String(k + 1)} texte={choix} etat={etat(k)} />
        ))}
      </View>
      {!q.explication && /^\d+$/.test(q.id) ? (
        <View style={styles.options}>
          <Bouton variante="secondaire" libelle={libelleAvecPrix(t, t('payant.voirExplication'), payant.prix('quiz_explanation'))} desactive={payant.encours} onPress={() => void voirExplication(n)} />
          {payant.refus ? <Banniere ton="erreur" titre={payant.refus.raison === 'erreur' ? t('payant.erreur') : payant.refus.raison === 'limite' ? t('payant.limite') : t('payant.insuffisant', { n: payant.refus.cout, solde: payant.refus.solde ?? 0 })} /> : null}
        </View>
      ) : null}
      {q.explication ? (
        <View style={[styles.explication, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('correction.explication')}</Text>
          <Text style={[typo.texte, { color: theme.texte.principal }]}>{q.explication}</Text>
        </View>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pied: { flexDirection: 'row', gap: espace[4] },
  options: { gap: espace[3] },
  explication: { gap: espace[2], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.m },
});
