import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { scoresSections, statutsDesQuestions } from '@/services/certification/bilanMini';
import { obtenirReglages } from '@/services/certification/etat';
import { construireDetail, enregistrerDetail } from '@/services/certification/detailTentative';
import { scoreBorne } from '@/services/certification/listesTests';
import { lancerAutreTest } from '@/services/certification/passerAutreTest';
import { marquerEtapeFaite } from '@/services/certification/planFaites';
import { effacerMini, lancerDefTest, lireMini, terminerMini, type EtatMini } from '@/services/certification/miniTest';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { BilanDefinition } from './BilanDefinition';
import { GrilleQuestions } from './GrilleQuestions';
import { ConfirmationPlan, EnteteToeic, Squelette } from './ui';

type Phase = { nom: 'chargement' } | { nom: 'attente'; etat: EtatMini } | { nom: 'ok'; etat: EtatMini };

/**
 * Fin d'Examen (v28, V_FIN) : score estimé d'un seul chiffre, Écoute et lecture, grille des questions. Les questions sans
 * réponse comptent fausses. Aucune correction ici : elle se revoit depuis « Revoir mes réponses ».
 */
export function BilanMini() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [phase, setPhase] = useState<Phase>({ nom: 'chargement' });
  const [occupe, setOccupe] = useState(false);
  const signale = useRef(false);
  const [maxScore, setMaxScore] = useState<number | null>(null);
  useEffect(() => {
    void obtenirReglages().then((r) => setMaxScore(r.objectifMax)).catch(() => {});
  }, []);

  const calculer = useCallback(async () => {
    const local = await lireMini();
    if (!local) {
      router.replace('/tests' as never);
      return;
    }
    setOccupe(true);
    try {
      const fini = await terminerMini(local);
      setPhase({ nom: 'ok', etat: fini });
    } catch {
      // Sans réseau : les réponses restent sur l'appareil, le bilan attend.
      setPhase({ nom: 'attente', etat: local });
    } finally {
      setOccupe(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void calculer();
  }, [calculer]);

  const fin = phase.nom === 'ok' ? phase.etat.fin : null;
  useEffect(() => {
    if (!fin || signale.current) return;
    signale.current = true;
    suivre('cert_mock_completed', { kind: fin.kind, score_min: fin.score_min, score_max: fin.score_max });
    // Le mini-test ou le test fait est l'étape correspondante du plan du jour.
    void marquerEtapeFaite(fin.kind === 'mini' ? 'mini' : 'test');
  }, [fin]);

  // Détail de la tentative (« Par notion », « Questions ratées » de sa page) : gardé sur l'appareil dès le bilan.
  const questionsFin = phase.nom === 'ok' ? phase.etat.tentative.questions : null;
  useEffect(() => {
    if (!fin || !questionsFin) return;
    void enregistrerDetail(fin.attempt_id, construireDetail(questionsFin, fin.results));
  }, [fin, questionsFin]);

  const sortir = async (vers: string) => {
    await effacerMini();
    router.replace(vers as never);
  };

  if (phase.nom === 'chargement') {
    return (
      <Ecran entete={<EnteteToeic titre={t('certification.bilanMini.entete')} />}>
        <Text accessibilityLiveRegion="polite" style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.bilanMini.chargement')}</Text>
        <Squelette lignes={3} />
      </Ecran>
    );
  }
  if (phase.nom === 'attente' || !fin) {
    return (
      <Ecran entete={<EnteteToeic titre={t('certification.bilanMini.entete')} />}>
        <View style={styles.groupe}>
          <Banniere ton="alerte" titre={t('certification.bilanMini.attenteTitre')} texte={t('certification.bilanMini.attenteTexte')} />
          <Bouton libelle={t('certification.bilanMini.reessayer')} desactive={occupe} onPress={() => void calculer()} />
          <Bouton variante="texte" libelle={t('certification.bilanMini.retour')} onPress={() => router.replace('/tests' as never)} />
        </View>
      </Ecran>
    );
  }

  const etat = phase.etat;
  const total = etat.tentative.questions.length;
  const bonnes = Object.values(fin.per_part).reduce((a, p) => a + p.correct, 0);
  const avecEstimation = fin.estimated && fin.score !== null;
  const sections = scoresSections(fin.per_part);
  const statuts = statutsDesQuestions(etat.tentative.questions.map((q) => q.id), fin.results);
  const def = etat.definition;
  // Échelle du score de la définition (D-55, D-58) : bonnes réponses sur les questions pour un mixte, moitié du total pour
  // un demi-test, total pour le test complet ; jamais au-dessus de son maximum.
  // Score de la tentative : la valeur exacte du serveur quand elle existe. Demi-tests et test complet la portent
  // dans `score` et leur fourchette reste toujours vide ; le mixte porte son estimation ponctuelle dans `score`
  // aussi. La borne haute `score_max` n'est qu'un repli pour d'anciens `fin` sans `score` : ce n'est pas un score.
  const scoreTentative = fin.score ?? fin.score_max;
  const maxDef = def ? scoreBorne(def.kind, scoreTentative ?? def.meilleurAvant, total, maxScore)?.max ?? null : null;
  const scoreAffiche = scoreTentative !== null && maxDef !== null ? Math.min(scoreTentative, maxDef) : scoreTentative;

  if (def) {
    const refaire = async () => {
      const exam = etat.exam;
      const meilleur = Math.max(def.meilleurAvant ?? 0, scoreTentative ?? 0) || null;
      const res = await lancerDefTest(exam, def.id, def.kind, meilleur);
      if (res.statut === 'demarre') router.replace('/certification/mini-test' as never);
      else if (res.statut === 'compte_requis') router.push('/compte/creer');
    };
    const autre = async () => {
      const res = await lancerAutreTest(etat.exam, def.kind);
      if (res?.statut === 'demarre') router.replace('/certification/mini-test' as never);
      else if (res?.statut === 'compte_requis') router.push('/compte/creer');
      else await sortir(`/certification/liste-tests?kind=${def.kind}`);
    };
    return (
      <Ecran
        entete={<EnteteToeic titre={t('certification.bilanMini.entete')} />}
        pied={
          <View style={styles.groupe}>
            {/* La revue se pousse par-dessus le bilan, comme dans la branche simple : l'état local (questions,
                réponses, résultats) reste en place pour les allers-retours bilan ↔ revue. Il n'est effacé que
                par les sorties définitives ci-dessous (sortir, ou un nouveau test lancé qui écrase l'état). */}
            {/* Maquette v34 : « Refaire pour améliorer ma note » est l'action verte, puis les sorties en blanc. */}
            <Bouton libelle={t('certification.tests.detail.refaire')} onPress={() => void refaire()} retour />
            <Bouton variante="secondaire" libelle={t('certification.tests.detail.autre')} onPress={() => void autre()} />
            <Bouton variante="secondaire" libelle={t('certification.tests.detail.voirNote')} onPress={() => void sortir('/certification/tentatives')} />
            <Bouton variante="secondaire" libelle={t('certification.bilanMini.revoir')} onPress={() => router.push('/certification/mini-revue' as never)} />
            <Bouton variante="secondaire" libelle={t('certification.tests.bilanDef.retour')} onPress={() => void sortir('/tests')} />
          </View>
        }
      >
        <BilanDefinition score={scoreAffiche} meilleurAvant={def.meilleurAvant} max={maxDef} perPart={fin.per_part} compte={def.kind === 'mini' ? { bonnes, total } : undefined} contexte={etat.partie !== null ? t('certification.tests.bilanDef.contextePartie', { partie: etat.partie }) : undefined} />
        <ConfirmationPlan cle={def.kind === 'mini' ? 'mini' : 'test'} />
        {def.kind === 'mini' ? (
          <>
            {/* Variante mini-test par partie (écran 5 de la maquette « Fin de test ») : la grille des questions
                suit le bloc de détail, comme dans le bilan simple. */}
            <GrilleQuestions statuts={statuts} />
            <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('certification.bilanMini.sansReponseFausse')}</Text>
          </>
        ) : null}
      </Ecran>
    );
  }

  return (
    <Ecran
      entete={<EnteteToeic titre={t('certification.bilanMini.entete')} />}
      pied={
        <View style={styles.groupe}>
          <Bouton libelle={t('certification.bilanMini.revoir')} onPress={() => router.push('/certification/mini-revue' as never)} retour />
          <Bouton variante="texte" libelle={t('certification.bilanMini.retour')} onPress={() => void sortir('/tests')} />
        </View>
      }
    >
      <Carte style={{ gap: espace[2] }}>
        {avecEstimation ? (
          <>
            <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.bilanMini.scoreEstime')}</Text>
            <Text style={[typo.donnee, { color: theme.texte.principal, fontSize: 52, lineHeight: 58 }]}>{String(fin.score)}</Text>
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.bilanMini.estimationAide')}</Text>
          </>
        ) : (
          <>
            <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.bilanMini.scorePartie')}</Text>
            <Text style={[typo.h1, { color: theme.texte.principal }]}>{t('certification.bilanMini.sur', { c: bonnes, n: total })}</Text>
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.bilanMini.sansEstimation')}</Text>
          </>
        )}
      </Carte>
      {avecEstimation ? (
        <Carte style={{ gap: espace[3] }}>
          <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.bilanMini.ecouteLecture')}</Text>
          <View style={styles.sections}>
            <Section libelle={t('certification.bilanMini.listening')} score={sections.listening} />
            <Section libelle={t('certification.bilanMini.reading')} score={sections.reading} />
          </View>
        </Carte>
      ) : null}
      <GrilleQuestions statuts={statuts} />
      <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('certification.bilanMini.sansReponseFausse')}</Text>
    </Ecran>
  );
}

/** Une section (Listening ou Reading) : nom, score sur 495 et barre de progression. */
function Section({ libelle, score }: { libelle: string; score: number }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{libelle}</Text>
      <Text style={[typo.donnee, { color: theme.texte.principal }]}>{String(score)}</Text>
      <View style={[styles.barre, { backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}>
        <View style={[styles.remplissage, { width: `${Math.round((score / 495) * 100)}%`, backgroundColor: theme.etat.succes }]} />
      </View>
      <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{t('certification.bilanMini.sur495')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[2] },
  sections: { flexDirection: 'row', gap: espace[3] },
  section: { flex: 1, gap: espace[1] },
  barre: { height: 8, borderWidth: 1, borderRadius: 4, overflow: 'hidden' },
  remplissage: { height: '100%' },
});
