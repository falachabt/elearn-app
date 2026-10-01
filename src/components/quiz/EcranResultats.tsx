import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireCorrection, statuts, type Correction } from '@/services/correction';
import { suivre } from '@/services/analytics';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { BoutonFermer } from '../arrivee/MiniTest';
import { Ligne } from '../entrainement/Ligne';
import { ResultatsQuiz } from './ResultatsQuiz';

/** Cours des questions ratées, sans doublon, dans l'ordre du quiz. */
function coursRates(c: Correction, s: ReturnType<typeof statuts>) {
  const vus = new Map<number, string>();
  c.questions.forEach((q, i) => {
    if (s[i] !== 'juste' && q.cours && !vus.has(q.cours.id)) vus.set(q.cours.id, q.cours.nom);
  });
  return [...vus].map(([id, nom]) => ({ id, nom }));
}

const relire = (c: { id: number; nom: string }) => {
  suivre('mission_lesson_review_opened', { cours: c.id });
  router.push({ pathname: '/cours/chapitre', params: { id: String(c.id), nom: c.nom } });
};

/**
 * Résultats d'un quiz sans écran de fin propre (refaire ses erreurs, quiz libre) : score et grille (M5-10), puis
 * « Relire le cours » pour revenir sur la leçon avant de retenter.
 */
export function EcranResultats() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [c, setC] = useState<Correction | null>(null);
  const [liste, setListe] = useState(false);
  useEffect(() => {
    let actif = true;
    lireCorrection().then((x) => actif && setC(x));
    return () => {
      actif = false;
    };
  }, []);
  const fermer = () => (router.canGoBack() ? router.back() : router.replace('/'));
  if (!c) return <Ecran>{null}</Ecran>;
  const s = statuts(c);
  const rates = coursRates(c, s);
  return (
    <Ecran pied={<Bouton libelle={t('correction.terminer')} onPress={fermer} />} entete={<BoutonFermer libelle={t('correction.terminer')} onPress={fermer} />}>
      <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.principal }]}>{t('correction.score', { score: s.filter((x) => x === 'juste').length, total: s.length })}</Text>
      <ResultatsQuiz statuts={s} leconsRatees={{ nombre: rates.length, unCours: rates.length === 1, onPress: () => (rates.length === 1 ? relire(rates[0]) : setListe(true)) }} />
      {liste ? (
        <View style={styles.groupe}>
          {rates.map((r) => (
            <Ligne key={r.id} icone="book-outline" titre={r.nom} onPress={() => relire(r)} />
          ))}
        </View>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({ groupe: { gap: espace[4] } });
