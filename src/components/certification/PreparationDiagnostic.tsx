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

/**
 * Ce que contient le diagnostic, avant le premier passage (maquettes TOEIC-A5 et TOEIC-S7, version 16 :
 * fonction prepDiag dans toeic-revue-complete.html). Le nombre de questions vient de la configuration du serveur.
 */
export function PreparationDiagnostic({ complet = true }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [questions, setQuestions] = useState<number | null>(null);

  useEffect(() => {
    let actif = true;
    obtenirReglages()
      .then((r) => actif && setQuestions(r.scoreMinReponses))
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
            <Tuile libelle={t('certification.arrivee.tuileQuestions')} valeur={questions !== null ? t('certification.arrivee.repereQuestions', { n: questions }) : '—'} />
            <Tuile libelle={t('certification.arrivee.tuileDuree')} valeur={t('certification.arrivee.repereDuree')} />
            <Tuile libelle={t('certification.arrivee.tuilePrix')} valeur={t('certification.arrivee.repereGratuit')} />
          </View>
        </View>
      </Carte>
      <EtiquetteSection texte={t('certification.arrivee.contientTitre')} />
      <LigneChoix icone={Play} titre={t('certification.arrivee.contientEcouteTitre')} aide={t('certification.arrivee.contientEcouteAide')} />
      <LigneChoix icone={BookOpen} titre={t('certification.arrivee.contientLectureTitre')} aide={t('certification.arrivee.contientLectureAide')} />
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
