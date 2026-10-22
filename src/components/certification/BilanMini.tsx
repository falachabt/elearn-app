import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { scoresSections, statutsDesQuestions } from '@/services/certification/bilanMini';
import { obtenirReglages } from '@/services/certification/etat';
import { effacerMini, lancerDefTest, lireMini, terminerMini, type EtatMini } from '@/services/certification/miniTest';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { BilanDefinition } from './BilanDefinition';
import { GrilleQuestions } from './GrilleQuestions';
import { EnteteToeic, Squelette } from './ui';

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
  }, [fin]);

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
  const maxDef = def ? (def.kind === 'full' ? maxScore : maxScore === null ? null : maxScore / 2) : null;

  if (def) {
    const refaire = async () => {
      const exam = etat.exam;
      const meilleur = Math.max(def.meilleurAvant ?? 0, fin.score_max ?? 0) || null;
      const res = await lancerDefTest(exam, def.id, def.kind, meilleur);
      if (res.statut === 'demarre') router.replace('/certification/mini-test' as never);
      else if (res.statut === 'compte_requis') router.push('/compte/creer');
    };
    return (
      <Ecran
        entete={<EnteteToeic titre={t('certification.bilanMini.entete')} />}
        pied={
          <View style={styles.groupe}>
            <Bouton libelle={t('certification.tests.detail.refaire')} onPress={() => void refaire()} />
            <Bouton variante="secondaire" libelle={t('certification.tests.detail.voirNote')} onPress={() => void sortir('/certification/tentatives')} />
            <Bouton variante="secondaire" libelle={t('certification.tests.detail.autre')} onPress={() => void sortir(`/certification/liste-tests?kind=${def.kind}`)} />
            <Bouton variante="texte" libelle={t('certification.tests.bilanDef.retour')} onPress={() => void sortir('/tests')} />
          </View>
        }
      >
        <BilanDefinition scoreMax={fin.score_max} meilleurAvant={def.meilleurAvant} max={maxDef} />
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
