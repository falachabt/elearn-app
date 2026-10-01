import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lireCorrection, statuts, type Correction } from '@/services/correction';
import { suivre } from '@/services/analytics';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Ecran } from '../Ecran';
import { Feuille } from '../Feuille';
import { BoutonFermer } from '../arrivee/MiniTest';
import { CarteListe } from '../liste/CarteListe';
import { PastilleType } from '../liste/PastilleType';
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
  // Relu au retour de « Refaire mes erreurs », qui met à jour cette correction.
  useFocusEffect(
    useCallback(() => {
      let actif = true;
      lireCorrection().then((x) => actif && setC(x));
      return () => {
        actif = false;
      };
    }, []),
  );
  const fermer = () => (router.canGoBack() ? router.back() : router.replace('/'));
  if (!c) return <Ecran>{null}</Ecran>;
  const s = statuts(c);
  const rates = coursRates(c, s);
  const justes = s.filter((x) => x === 'juste').length;
  const taux = s.length ? justes / s.length : 0;
  const message = t(taux >= 0.8 ? 'correction.bravo' : taux >= 0.5 ? 'correction.bienJoue' : 'correction.onContinue');
  return (
    <>
      <Ecran entete={<BoutonFermer petit libelle={t('correction.terminer')} onPress={fermer} />}>
        <Text accessibilityRole="header" style={[typo.h2, { color: theme.texte.principal }]}>{t('correction.titreScore', { score: justes, total: s.length, message })}</Text>
        <ResultatsQuiz statuts={s} leconsRatees={{ nombre: rates.length, unCours: rates.length === 1, onPress: () => (rates.length === 1 ? relire(rates[0]) : setListe(true)) }} />
      </Ecran>
      <Feuille ouverte={liste} onFermer={() => setListe(false)} titre={t('correction.leconsTitre')} actions={[{ libelle: t('correction.fermer'), onPress: () => setListe(false), variante: 'secondaire' }]}>
        <View style={styles.groupe}>
          {rates.map((r) => (
            <CarteListe
              key={r.id}
              gauche={<PastilleType type="lecon" />}
              titre={r.nom}
              onPress={() => {
                setListe(false);
                relire(r);
              }}
            />
          ))}
        </View>
      </Feuille>
    </>
  );
}

const styles = StyleSheet.create({ groupe: { gap: espace[3] } });
