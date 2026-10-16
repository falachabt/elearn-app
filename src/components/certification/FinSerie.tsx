import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { obtenirReglages } from '@/services/certification/etat';
import { terminerBlocSuivant } from '@/services/certification/seanceJour';
import { ecrireSerie, effacerSerie, lireSerieEnCours, resumerSerie, type EtatSerie, type ResumeSerie } from '@/services/certification/serie';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Ecran } from '../Ecran';
import { EnteteToeic } from './ui';

/** B11 · Fin de série : score, rejeu espacé, notions touchées, mots ajoutés au carnet. */
export function FinSerie() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [etat, setEtat] = useState<EtatSerie | null>(null);
  const [resume, setResume] = useState<ResumeSerie | null>(null);

  useEffect(() => {
    let actif = true;
    void (async () => {
      const e = await lireSerieEnCours();
      if (!actif) return;
      if (!e || !e.termine) {
        router.replace('/certification/serie' as never);
        return;
      }
      let delais = [1, 3];
      try {
        delais = (await obtenirReglages()).delaisRejeuJours;
      } catch {
        // garde les délais par défaut
      }
      if (!actif) return;
      // Une série lancée par la séance du jour clôt son bloc (idempotent : un bloc terminé n'est pas recompté).
      if (e.origine === 'seance' && !e.blocClos) {
        await terminerBlocSuivant();
        await ecrireSerie({ ...e, blocClos: true });
      }
      if (!actif) return;
      setEtat(e);
      setResume(resumerSerie(e, { delaisRejeuJours: delais }));
    })();
    return () => {
      actif = false;
    };
  }, []);

  const refaire = async () => {
    if (!etat) return;
    const { part, notion } = etat.perimetre;
    await effacerSerie();
    router.replace({ pathname: '/certification/serie', params: { ...(part ? { part: String(part) } : {}), ...(notion ? { notion } : {}) } } as never);
  };

  const rejeu = (() => {
    if (!resume || resume.ratees === 0) return null;
    const [a, b] = resume.delaisRejeu;
    if (a === undefined) return null;
    if (b === undefined) return a === 1 ? t('certification.finSerie.rejeuDelaiSeulUn') : t('certification.finSerie.rejeuDelaiSeul', { a });
    return a === 1 ? t('certification.finSerie.rejeuDelaisUn', { b }) : t('certification.finSerie.rejeuDelais', { a, b });
  })();

  return (
    <Ecran
      entete={<EnteteToeic titre={t('certification.finSerie.entete')} />}
      pied={
        <View style={styles.pied}>
          <Bouton libelle={t('certification.finSerie.seance')} onPress={() => router.replace(etat?.origine === 'seance' ? ('/certification/seance' as never) : '/')} retour />
          {etat?.origine === 'seance' ? null : <Bouton variante="secondaire" libelle={t('certification.finSerie.refaire')} onPress={() => void refaire()} />}
        </View>
      }
    >
      {resume ? (
        <>
          <View style={[styles.carte, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
            <Text style={[typo.petit, { color: theme.texte.surCouleur }]}>{t('certification.finSerie.resultat')}</Text>
            <Text accessibilityRole="header" style={[typo.h1, { color: theme.texte.surCouleur }]}>{t('certification.finSerie.score', { n: resume.bonnes, total: resume.total })}</Text>
            <Text style={[typo.texte, { color: theme.texte.surCouleur }]}>
              {resume.ratees === 0 ? t('certification.finSerie.aucuneRatee') : resume.ratees === 1 ? t('certification.finSerie.rateeUne') : t('certification.finSerie.ratees', { n: resume.ratees })}
            </Text>
            {rejeu ? <Text style={[typo.petit, { color: theme.texte.surCouleur }]}>{rejeu}</Text> : null}
          </View>
          {resume.notions.length > 0 ? (
            <View style={styles.groupe}>
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('certification.finSerie.notions')}</Text>
              {resume.notions.map((n) => (
                <Text key={n.id} style={[typo.texte, { color: theme.texte.principal }]}>{n.title}</Text>
              ))}
            </View>
          ) : null}
          {resume.mots.length > 0 ? (
            <View style={styles.groupe}>
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{t('certification.finSerie.mots')}</Text>
              {resume.mots.map((m) => (
                <Text key={m.id} style={[typo.texte, { color: theme.texte.principal }]}>{m.word}</Text>
              ))}
            </View>
          ) : null}
          {resume.enAttente > 0 ? <Banniere ton="info" titre={t('certification.finSerie.enAttente')} /> : null}
        </>
      ) : null}
    </Ecran>
  );
}

const styles = StyleSheet.create({
  carte: { gap: espace[2], padding: espace[6], borderWidth: bord.normal, borderRadius: rayon.l },
  groupe: { gap: espace[1] },
  pied: { gap: espace[2] },
});
