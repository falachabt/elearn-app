import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { enregistrerCorrection } from '@/services/correction';
import { lireSessions, type SessionQuiz } from '@/services/entrainement';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';
import { COULEUR_GENRE } from './Ligne';

/** Page d'un quiz déjà joué : ses infos, le meilleur score, les sessions passées à revoir, et une nouvelle session. */
export function DetailQuiz() {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const { id, cours, nom, titre, questions, numero } = useLocalSearchParams<{ id: string; cours: string; nom?: string; titre?: string; questions?: string; numero?: string }>();
  const [sessions, setSessions] = useState<SessionQuiz[]>([]);

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      void lireSessions(String(id)).then((s) => actif && setSessions(s));
      return () => {
        actif = false;
      };
    }, [id]),
  );

  const pct = (s: SessionQuiz) => (s.total ? Math.round((s.score / s.total) * 100) : 0);
  const meilleur = sessions.length ? Math.max(...sessions.map(pct)) : null;
  const quand = (iso: string) =>
    new Date(iso).toLocaleString(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const revoir = async (s: SessionQuiz) => {
    await enregistrerCorrection({ source: 'libre', questions: s.questions, reponses: s.reponses });
    router.push('/quiz/resultats');
  };
  const nouvelle = () => router.push({ pathname: '/entrainement/quiz', params: { id: String(id), cours: String(cours), nom: nom ?? '' } });

  return (
    <Ecran
      pied={<Bouton libelle={t('entrainement.detailNouvelle')} onPress={nouvelle} retour />}
      entete={<BoutonFermer icone="chevron-back" libelle={t('reviser.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/reviser'))} />}
    >
      <View style={styles.tete}>
        <View style={[styles.pastille, { backgroundColor: COULEUR_GENRE.quiz, borderColor: theme.bord.fort }]}>
          <Ionicons name="help-circle-outline" size={26} color={theme.texte.surCouleur} />
        </View>
        <View style={styles.flex}>
          <Text style={[typo.legende, styles.etiquette, { color: theme.texte.secondaire }]}>{numero ? t('entrainement.etiquetteQuizN', { n: Number(numero) }) : t('entrainement.etiquetteQuiz')}</Text>
          <Text accessibilityRole="header" style={[typo.h2, { color: theme.texte.principal }]}>{titre}</Text>
        </View>
      </View>
      <Text style={[typo.texte, { color: theme.texte.secondaire }]}>
        {[nom || null, questions ? t('entrainement.questions', { n: Number(questions) }) : null, meilleur !== null ? t('entrainement.meilleur', { n: meilleur }) : null].filter(Boolean).join(' · ')}
      </Text>
      {sessions.length ? (
        <View style={styles.groupe}>
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('entrainement.detailSessions')}</Text>
          <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('entrainement.detailAide')}</Text>
          {sessions.map((s) => {
            const p = pct(s);
            const reussie = p >= 67;
            const resume = t('entrainement.detailSession', { score: s.score, total: s.total, pct: p });
            return (
              <Appui key={s.le} accessibilityRole="button" accessibilityLabel={`${quand(s.le)}. ${resume}`} onPress={() => void revoir(s)} rayon={rayon.l} ombre={4} decalage={3} couleurOmbre={theme.ombre}>
                <View style={[styles.ligne, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                  <Ionicons name={reussie ? 'checkmark-circle' : 'refresh-circle'} size={24} color={reussie ? theme.marque.principale : theme.etat.erreur} />
                  <View style={styles.flex}>
                    <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{resume}</Text>
                    <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{quand(s.le)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.texte.secondaire} />
                </View>
              </Appui>
            );
          })}
        </View>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tete: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  pastille: { width: 52, height: 52, borderRadius: rayon.m, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  etiquette: { textTransform: 'uppercase', letterSpacing: 0.5 },
  groupe: { gap: espace[4] },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[4], padding: espace[5], borderWidth: bord.normal, borderRadius: rayon.l },
});
