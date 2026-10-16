import { router } from 'expo-router';
import { TriangleAlert } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { obtenirReglages } from '@/services/certification/etat';
import { effacerMini, lireMini, terminerMini, type EtatMini } from '@/services/certification/miniTest';
import { notionsPerdues } from '@/services/certification/bilanMini';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { EnteteToeic, EtiquetteSection, LigneChoix, Squelette } from './ui';

type Phase = { nom: 'chargement' } | { nom: 'attente'; etat: EtatMini } | { nom: 'ok'; etat: EtatMini };

/** Bilan réduit d'un mini-test (E6 réduit) : estimation large, jamais présentée comme un score officiel. */
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
  const parties = Object.entries(fin.per_part).sort((a, b) => Number(a[0]) - Number(b[0]));
  const avecEstimation = fin.estimated && fin.score_min !== null && fin.score_max !== null;
  const parPartie = etat.partie !== null;
  const perdues = notionsPerdues(fin.results);

  return (
    <Ecran
      entete={<EnteteToeic titre={t('certification.bilanMini.entete')} />}
      pied={
        <View style={styles.groupe}>
          <Bouton libelle={t('certification.bilanMini.retour')} onPress={() => void sortir('/tests')} retour />
          <Bouton variante="texte" libelle={t('certification.bilanMini.historique')} onPress={() => void sortir('/certification/historique')} />
        </View>
      }
    >
      <Carte style={{ gap: espace[2] }}>
        {avecEstimation ? (
          <>
            <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.bilanMini.estimation', { total: maxScore ?? '' })}</Text>
            <Text style={[typo.h1, { color: theme.texte.principal }]}>{t('certification.bilanMini.plage', { min: fin.score_min!, max: fin.score_max! })}</Text>
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.bilanMini.estimationAide')}</Text>
          </>
        ) : (
          <>
            <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.bilanMini.scorePartie')}</Text>
            <Text style={[typo.h1, { color: theme.texte.principal }]}>{t('certification.bilanMini.sur', { c: bonnes, n: total })}</Text>
            <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{parPartie ? t('certification.bilanMini.sansEstimation') : t('certification.bilanMini.peuDeReponses')}</Text>
          </>
        )}
      </Carte>
      {parties.length > 0 ? (
        <>
          <EtiquetteSection texte={t('certification.bilanMini.parties')} />
          {parties.map(([partie, p]) => (
            <LigneChoix key={partie} icone={TriangleAlert} titre={t('certification.bilanMini.ligneParti', { n: partie })} aide={t('certification.bilanMini.sur', { c: p.correct, n: p.answered })} />
          ))}
        </>
      ) : null}
      <EtiquetteSection texte={t('certification.bilanMini.notions')} />
      {perdues.length === 0 ? <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.bilanMini.aucuneNotion')}</Text> : null}
      {perdues.map((n) => (
        <LigneChoix
          key={n.id}
          icone={TriangleAlert}
          titre={n.titre}
          aide={n.manquees === 1 ? t('certification.bilanMini.notionPerduUne') : t('certification.bilanMini.notionPerdus', { n: n.manquees })}
          onPress={() => router.push({ pathname: '/certification/notion/[id]', params: { id: n.id, source: 'bilan_mini' } } as never)}
        />
      ))}
    </Ecran>
  );
}

const styles = StyleSheet.create({ groupe: { gap: espace[2] } });
