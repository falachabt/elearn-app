import { ChevronRight } from 'lucide-react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { enregistrerCorrection, statuts, type StatutQuestion } from '@/services/correction';
import { lireSessions, type SessionQuiz } from '@/services/entrainement';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo, type Theme } from '@/theme/theme';

import { Appui } from '../Appui';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';
import { libelleQuiz } from './libelles';

/** Mêmes couleurs que l'écran de résultats : juste, faux, sans réponse. */
export const couleurStatut = (theme: Theme, s: StatutQuestion) => (s === 'juste' ? theme.marque.principale : s === 'faux' ? theme.etat.erreur : theme.etat.alerte);

/** D8 · Quiz déjà joué (M5-13, revue design écran 4) : deux chiffres, les 10 dernières sessions à revoir, « Nouvelle session » en bas. */
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
  const quand = (iso: string) => new Date(iso).toLocaleString(langue === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const duree = (s?: number) => (s === undefined ? null : s < 60 ? t('entrainement.dureeS', { n: s }) : t('entrainement.dureeMin', { n: Math.round(s / 60) }));
  const revoir = async (s: SessionQuiz) => {
    await enregistrerCorrection({ source: 'libre', questions: s.questions, reponses: s.reponses, contexte: { type: 'libre', quiz: String(id), le: s.le } });
    router.push('/quiz/resultats');
  };
  const nouvelle = () => router.push({ pathname: '/entrainement/quiz', params: { id: String(id), cours: String(cours), nom: nom ?? '' } });

  return (
    <Ecran
      pied={<Bouton libelle={t('entrainement.detailNouvelle')} onPress={nouvelle} retour />}
      entete={
        <>
          <BoutonFermer petit icone="chevron-back" libelle={t('reviser.retour')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/reviser'))} />
          <Text accessibilityRole="header" numberOfLines={2} style={[typo.texteFort, styles.titre, { color: theme.texte.principal }]}>
            {libelleQuiz(t, titre ?? '', nom ?? '', numero ? Number(numero) : undefined)}
          </Text>
        </>
      }
    >
      <View style={styles.chiffres}>
        <Chiffre libelle={t('entrainement.detailQuestions')} valeur={questions ?? '–'} />
        <Chiffre libelle={t('entrainement.detailMeilleur')} valeur={meilleur !== null ? `${meilleur} %` : '–'} />
      </View>
      {sessions.length ? (
        <View style={styles.groupe}>
          <Text accessibilityRole="header" style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('entrainement.detailSessions')}</Text>
          {sessions.map((s) => {
            const resume = t('entrainement.detailSession', { score: s.score, total: s.total, pct: pct(s) });
            const infos = [quand(s.le), duree(s.dureeS)].filter(Boolean).join(' · ');
            return (
              <Appui key={s.le} accessibilityRole="button" accessibilityLabel={`${infos}. ${resume}`} onPress={() => void revoir(s)} rayon={rayon.l} ombre={ombre.carte} decalage={2} couleurOmbre={theme.ombre}>
                <View style={[styles.session, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
                  <View style={styles.ligne}>
                    <View style={styles.flex}>
                      <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{resume}</Text>
                      <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{infos}</Text>
                    </View>
                    <Text style={[typo.boutonPetit, { color: theme.texte.lien }]}>{t('entrainement.detailRevoir')}</Text>
                    <ChevronRight size={18} strokeWidth={2} color={theme.texte.lien} />
                  </View>
                  <View style={styles.grille} testID="mini-grille">
                    {statuts(s).map((st, i) => (
                      <View key={i} style={[styles.case, { backgroundColor: couleurStatut(theme, st), borderColor: theme.bord.fort }]} />
                    ))}
                  </View>
                </View>
              </Appui>
            );
          })}
        </View>
      ) : null}
    </Ecran>
  );
}

function Chiffre({ libelle, valeur }: { libelle: string; valeur: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.chiffre, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
      <Text style={[typo.chiffreL, { color: theme.texte.principal }]}>{valeur}</Text>
      <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{libelle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titre: { flex: 1, fontSize: 15, lineHeight: 20 },
  chiffres: { flexDirection: 'row', gap: espace[4] },
  chiffre: { flex: 1, padding: espace[4], borderWidth: bord.normal, borderRadius: rayon.l, gap: espace[1] },
  groupe: { gap: espace[4] },
  session: { padding: espace[4], gap: espace[3], borderWidth: bord.normal, borderRadius: rayon.l },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[2] },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  case: { width: '9.2%', aspectRatio: 1, borderRadius: 3, borderWidth: 1 },
});
