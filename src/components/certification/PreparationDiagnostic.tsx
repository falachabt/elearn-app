import { BookOpen, Play } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { obtenirReglages } from '@/services/certification/etat';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Carte } from '../Carte';
import { Etiquette } from '../Etiquette';
import { EtiquetteSection, LigneChoix } from './ui';

type Props = {
  /** Écran A5 (arrivée, plein écran) : ajoute « Ce que ça donne ». L'onglet S7 le retire pour tenir sous le bouton. */
  complet?: boolean;
};

type Repartition = { total: number; ecoute: number; lecture: number };

/** Répartition annoncée, dérivée du plan servi (`diag_counts`) : écoute = parties 1 à 4, lecture = parties 5 à 7. */
const repartition = (comptes: Record<number, number>): Repartition => {
  let ecoute = 0;
  let lecture = 0;
  for (const [partie, n] of Object.entries(comptes)) {
    if (Number(partie) <= 4) ecoute += n;
    else lecture += n;
  }
  return { total: ecoute + lecture, ecoute, lecture };
};

/**
 * Ce que contient le diagnostic, avant le premier passage (maquettes TOEIC-A5 et TOEIC-S7, version 16 :
 * fonction prepDiag dans toeic-revue-complete.html). Le nombre de questions vient du plan servi par le serveur
 * (`diag_counts`) — jamais du seuil d'estimation du score, qui ne compte pas les questions.
 */
export function PreparationDiagnostic({ complet = true }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [rep, setRep] = useState<Repartition | null>(null);

  useEffect(() => {
    let actif = true;
    obtenirReglages()
      .then((r) => actif && setRep(r.diagComptes ? repartition(r.diagComptes) : null))
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, []);

  return (
    <View style={styles.groupe}>
      <Carte>
        <View style={styles.carte}>
          <Etiquette texte={t('certification.arrivee.badge')} jaune />
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>
            {t('certification.arrivee.titre')}
          </Text>
          <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.arrivee.intro')}</Text>
          <View style={styles.tuiles}>
            <Tuile libelle={t('certification.arrivee.tuileQuestions')} valeur={rep !== null ? t('certification.arrivee.repereQuestions', { n: rep.total }) : '—'} />
            <Tuile libelle={t('certification.arrivee.tuileDuree')} valeur={t('certification.arrivee.repereDuree')} />
            <Tuile libelle={t('certification.arrivee.tuilePrix')} valeur={t('certification.arrivee.repereGratuit')} />
          </View>
        </View>
      </Carte>
      <EtiquetteSection texte={t('certification.arrivee.contientTitre')} />
      <LigneChoix icone={Play} titre={t('certification.arrivee.contientEcouteTitre')} aide={rep !== null ? t('certification.arrivee.contientEcouteAide', { n: rep.ecoute }) : t('certification.arrivee.contientEcouteAideLibre')} />
      <LigneChoix icone={BookOpen} titre={t('certification.arrivee.contientLectureTitre')} aide={rep !== null ? t('certification.arrivee.contientLectureAide', { n: rep.lecture }) : t('certification.arrivee.contientLectureAideLibre')} />
      {complet ? (
        <Carte>
          <View style={styles.carte}>
            <EtiquetteSection texte={t('certification.arrivee.donneTitre')} />
            <Text style={[typo.petit, { color: theme.texte.principal }]}>{t('certification.arrivee.donneTexte')}</Text>
          </View>
        </Carte>
      ) : null}
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.arrivee.regle')}</Text>
    </View>
  );
}

function Tuile({ libelle, valeur }: { libelle: string; valeur: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.tuile, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
      <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{libelle}</Text>
      <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{valeur}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: espace[3] },
  carte: { gap: espace[2] },
  tuiles: { flexDirection: 'row', gap: espace[2], marginTop: espace[1] },
  tuile: { flex: 1, gap: espace[1], padding: espace[2], borderWidth: bord.normal, borderRadius: rayon.s },
});
