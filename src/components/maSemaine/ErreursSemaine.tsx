import { router, useLocalSearchParams } from 'expo-router';
import { RotateCw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { lireCorrection } from '@/services/correction';
import { lireErreursSemaine, noterCorrection, type ErreurJournal } from '@/services/erreursSemaine';
import { dimancheDe, jourCourt, semainePrecedente } from '@/services/maSemaine';
import type { QuestionTiree } from '@/services/miniTest';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { BoutonFermer, MiniTest } from '../arrivee/MiniTest';

const FORMAT_SEMAINE = /^\d{4}-\d{2}-\d{2}$/;
const retour = () => (router.canGoBack() ? router.back() : router.replace('/'));

/**
 * « Mes erreurs de la semaine » : liste des questions ratées pendant la semaine du rapport, avec la bonne réponse, et un
 * bouton pour toutes les refaire. Ouvert par « Refaire mes erreurs » de la carte « À rattraper » de Ma semaine.
 * Maquette : `docs/maquettes/erreurs-semaine.md`.
 */
export function ErreursSemaine() {
  const { t, langue } = useTraduction();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ semaine?: string }>();
  const semaine = params.semaine && FORMAT_SEMAINE.test(params.semaine) ? params.semaine : semainePrecedente();
  const [erreurs, setErreurs] = useState<ErreurJournal[] | null>(null);
  const [dernierQuiz, setDernierQuiz] = useState(false);
  const [refaire, setRefaire] = useState(false);
  const [bilan, setBilan] = useState<{ bonnes: number; total: number } | null>(null);

  const [essai, setEssai] = useState(0);

  useEffect(() => {
    let actif = true;
    void (async () => {
      const liste = await lireErreursSemaine(semaine).catch(() => []);
      const repli = liste.length ? false : !!(await lireCorrection().catch(() => null))?.questions.length;
      if (!actif) return;
      setErreurs(liste);
      setDernierQuiz(repli);
    })();
    return () => {
      actif = false;
    };
  }, [semaine, essai]);

  const nombre = erreurs?.length ?? null;
  useEffect(() => {
    if (nombre !== null) suivre('week_errors_viewed', { semaine, n: nombre });
  }, [nombre, semaine]);

  if (!erreurs) return null;

  if (refaire) {
    return (
      <MiniTest
        questions={erreurs.map((e) => e.question)}
        libelleFin={t('mission.fin')}
        libelleFermer={t('mission.fermer')}
        onFermer={() => setRefaire(false)}
        onTermine={async ({ questions, reponses }: { questions: QuestionTiree[]; reponses: number[] }) => {
          const bonnes = questions.filter((q, i) => reponses[i] === q.bonne).length;
          suivre('week_errors_retried', { semaine, score: bonnes, total: questions.length });
          // Une erreur corrigée sort du journal ; une erreur encore ratée y reste, à son jour d'origine.
          await noterCorrection({ questions, reponses }).catch(() => {});
          setBilan({ bonnes, total: questions.length });
          setEssai((x) => x + 1);
          setRefaire(false);
        }}
      />
    );
  }

  const surtitre = t('erreursSemaine.surtitre', { debut: jourCourt(semaine, langue), fin: jourCourt(dimancheDe(semaine), langue) });
  const n = erreurs.length;
  const entete = (
    <>
      <BoutonFermer icone="chevron-back" libelle={t('correction.retour')} onPress={retour} />
      <Text accessibilityRole="header" style={[typo.h3, styles.flex, { color: theme.texte.principal }]}>{t('erreursSemaine.titre')}</Text>
    </>
  );

  if (!n) {
    return (
      <Ecran entete={entete}>
        <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{surtitre}</Text>
        {bilan ? <Banniere ton="succes" titre={t('erreursSemaine.bilan', { bonnes: bilan.bonnes, total: bilan.total })} /> : null}
        <Text style={[typo.h2, { color: theme.texte.principal }]}>{t('erreursSemaine.videTitre')}</Text>
        <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('erreursSemaine.videTexte')}</Text>
        {dernierQuiz ? <Bouton variante="secondaire" libelle={t('erreursSemaine.dernierQuiz')} icone={<RotateCw size={18} color={theme.texte.principal} />} onPress={() => router.push('/mission/erreurs')} /> : null}
      </Ecran>
    );
  }

  const pied = <Bouton libelle={t(n === 1 ? 'erreursSemaine.refaireUne' : 'erreursSemaine.refairePlus', { n })} icone={<RotateCw size={18} color={theme.texte.surCouleur} />} onPress={() => setRefaire(true)} />;

  return (
    <Ecran entete={entete} pied={pied}>
      <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{surtitre}</Text>
      <Text style={[typo.h2, { color: theme.texte.principal }]}>{t(n === 1 ? 'erreursSemaine.compteUne' : 'erreursSemaine.comptePlus', { n })}</Text>
      {bilan ? <Banniere ton="succes" titre={t('erreursSemaine.bilan', { bonnes: bilan.bonnes, total: bilan.total })} /> : null}
      {erreurs.map(({ jour, question: q }) => (
        <Carte key={q.id} style={styles.carte} testID="erreur-semaine">
          <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{[q.libelleMatiere, q.chapitre, jourCourt(jour, langue)].filter(Boolean).join(' · ')}</Text>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{q.enonce}</Text>
          <View style={[styles.bonne, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
            <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('erreursSemaine.bonneReponse', { reponse: q.choix[q.bonne] ?? '' })}</Text>
          </View>
        </Carte>
      ))}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  carte: { gap: espace[3] },
  bonne: { padding: espace[3], borderWidth: bord.fin, borderRadius: rayon.m },
});
