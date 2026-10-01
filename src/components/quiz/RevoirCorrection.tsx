import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireCorrection, statuts, type Correction } from '@/services/correction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

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
