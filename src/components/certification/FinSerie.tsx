import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { obtenirReglages } from '@/services/certification/etat';
import { cleSerie, marquerEtapeFaite } from '@/services/certification/planFaites';
import { terminerBlocSuivant } from '@/services/certification/seanceJour';
import { titreAffiche } from '@/services/certification/titre';
import { ecrireSerie, effacerSerie, lireSerieEnCours, resumerSerie, type EtatSerie, type ResumeSerie } from '@/services/certification/serie';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';
import { RotateCcw } from 'lucide-react-native';

import { Banniere } from '../Banniere';
import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { Ecran } from '../Ecran';
import { ConfirmationPlan, EnteteToeic, EtiquetteSection, LigneChoix } from './ui';

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
      // La série est une étape du plan du jour (notion, partie ou rejeu) : elle reste dans la frise avec l'état « Fait ».
      await marquerEtapeFaite(cleSerie(e.perimetre));
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

  const perimetre = (() => {
    if (!etat || !resume) return null;
    const { part, notion } = etat.perimetre;
    const nomNotion = notion ? resume.notions.find((n) => n.id === notion)?.title : resume.notions.length === 1 ? resume.notions[0].title : undefined;
    return [part ? t('certification.finSerie.perimetrePartie', { n: part }) : null, nomNotion ? titreAffiche(nomNotion) : null].filter(Boolean).join(' · ') || null;
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
          <Carte style={styles.resultat}>
            <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.finSerie.resultat')}</Text>
            <Text accessibilityRole="header" accessibilityLabel={t('certification.finSerie.resultatLabel', { n: resume.bonnes, total: resume.total })} style={[typo.h1, { color: theme.texte.principal }]}>
              {t('certification.finSerie.score', { n: resume.bonnes, total: resume.total })}
            </Text>
            {perimetre ? <Text style={[typo.petit, { color: theme.texte.principal }]}>{perimetre}</Text> : null}
          </Carte>
          <ConfirmationPlan cle={cleSerie(etat!.perimetre)} />
          {resume.ratees === 0 ? (
            <Text style={[typo.texte, { color: theme.texte.principal }]}>{t('certification.finSerie.aucuneRatee')}</Text>
          ) : (
            <View style={styles.groupe}>
              <EtiquetteSection texte={resume.delaisRejeu[0] === 1 || resume.delaisRejeu[0] === undefined ? t('certification.finSerie.rejeuDemain') : t('certification.finSerie.rejeuDans', { n: resume.delaisRejeu[0] })} />
              <LigneChoix
                icone={RotateCcw}
                titre={resume.ratees === 1 ? t('certification.finSerie.rateeUne') : t('certification.finSerie.ratees', { n: resume.ratees })}
                aide={rejeu ?? undefined}
              />
            </View>
          )}
          {resume.notions.length > 0 ? (
            <View style={styles.groupe}>
              <EtiquetteSection texte={t('certification.finSerie.notions')} />
              <View style={styles.puces}>
                {resume.notions.map((n) => (
                  <Puce key={n.id} texte={titreAffiche(n.title)} />
                ))}
              </View>
            </View>
          ) : null}
          {resume.mots.length > 0 ? (
            <View style={styles.groupe}>
              <EtiquetteSection texte={t('certification.finSerie.mots')} />
              <View style={styles.puces}>
                {resume.mots.map((m) => (
                  <Puce key={m.id} texte={m.word} />
                ))}
              </View>
            </View>
          ) : null}
          {resume.enAttente > 0 ? <Banniere ton="info" titre={t('certification.finSerie.enAttente')} /> : null}
        </>
      ) : null}
    </Ecran>
  );
}

/** Puce (maquette B11) : pilule bordée, texte mono gras. */
function Puce({ texte }: { texte: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.puce, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
      <Text style={[typo.etiquette, styles.puceTexte, { color: theme.texte.principal }]}>{texte}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  resultat: { alignItems: 'center', gap: espace[3], paddingVertical: espace[7] },
  groupe: { gap: espace[3] },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[3] },
  puce: { borderWidth: bord.normal, borderRadius: rayon.pilule, paddingHorizontal: espace[4], paddingVertical: espace[2] },
  puceTexte: { textTransform: 'none' },
  pied: { gap: espace[2] },
});
