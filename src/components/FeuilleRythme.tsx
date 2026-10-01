import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { bornerTaille, enregistrerRythme, PAS_TAILLE, RYTHMES, TAILLE_DEFAUT, TAILLE_MAX, TAILLE_MIN } from '@/services/rythme';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Bouton } from './Bouton';
import { Feuille } from './Feuille';
import { Onglets } from './Onglets';

type Props = {
  ouverte: boolean;
  onFermer: () => void;
  /** Taille déjà choisie, pour la modifier depuis les réglages. */
  actuelle?: number | null;
  source: 'fin_mission' | 'parametres';
  onChoisi?: (n: number) => void;
};

type Onglet = 'questions' | 'temps';

/**
 * Rythme de la mission du jour (M4-08) : onglet « Questions » pour régler le nombre par pas de 5, onglet « Temps »
 * pour partir de 10 à 45 minutes ; l'élève valide le nombre affiché.
 */
export function FeuilleRythme({ ouverte, onFermer, actuelle, source, onChoisi }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [taille, setTaille] = useState(actuelle ?? TAILLE_DEFAUT);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [onglet, setOnglet] = useState<Onglet>('questions');
  // Repart de la taille enregistrée à chaque ouverture (état dérivé pendant le rendu, sans effet).
  const [ouverteAvant, setOuverteAvant] = useState(ouverte);
  if (ouverte !== ouverteAvant) {
    setOuverteAvant(ouverte);
    if (ouverte) {
      setTaille(actuelle ?? TAILLE_DEFAUT);
      setMinutes(null);
      setOnglet('questions');
    }
  }
  const ajuster = (n: number) => {
    setTaille(bornerTaille(n));
    setMinutes(null);
  };

  const valider = async () => {
    const n = await enregistrerRythme(taille);
    suivre('mission_goal_set', { minutes, questions: n, origine: source });
    onChoisi?.(n);
    onFermer();
  };

  return (
    <Feuille
      ouverte={ouverte}
      onFermer={onFermer}
      icone="timer-outline"
      titre={t('rythme.titre')}
      texte={t('rythme.texte')}
      actions={[{ libelle: t('rythme.valider', { n: taille }), onPress: () => void valider() }]}
    >
      <Onglets
        valeurs={[
          { valeur: 'questions', libelle: t('rythme.ongletQuestions') },
          { valeur: 'temps', libelle: t('rythme.ongletTemps') },
        ]}
        valeur={onglet}
        onChange={setOnglet}
      />
      <Text style={[typo.texteFort, styles.centre, { color: theme.texte.principal }]}>{t(onglet === 'questions' ? 'rythme.combien' : 'rythme.combienTemps')}</Text>
      {onglet === 'questions' ? (
        <View style={styles.reglage}>
          <Bouton petit variante="secondaire" libelle="−" accessibilityLabel={t('rythme.moins')} desactive={taille <= TAILLE_MIN} onPress={() => ajuster(taille - PAS_TAILLE)} />
          <Text accessibilityLiveRegion="polite" style={[typo.h3, styles.flex, styles.centre, { color: theme.texte.principal }]}>{t('rythme.questions', { n: taille })}</Text>
          <Bouton petit variante="secondaire" libelle="+" accessibilityLabel={t('rythme.plus')} desactive={taille >= TAILLE_MAX} onPress={() => ajuster(taille + PAS_TAILLE)} />
        </View>
      ) : (
        <>
          <View accessibilityRole="radiogroup" style={styles.choix}>
            {RYTHMES.map((r) => (
              <View key={r.minutes} style={styles.puce}>
                <Bouton
                  petit
                  variante={minutes === r.minutes ? 'primaire' : 'secondaire'}
                  libelle={t('rythme.minutes', { n: r.minutes })}
                  onPress={() => {
                    setTaille(r.questions);
                    setMinutes(r.minutes);
                  }}
                />
              </View>
            ))}
          </View>
          <Text accessibilityLiveRegion="polite" style={[typo.texteFort, styles.centre, { color: theme.texte.principal }]}>{t('rythme.environ', { n: taille })}</Text>
        </>
      )}
      <Text style={[typo.legende, styles.centre, { color: theme.texte.secondaire }]}>{t('rythme.conseil')}</Text>
    </Feuille>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  choix: { flexDirection: 'row', flexWrap: 'wrap', gap: espace[3] },
  puce: { width: '30%', flexGrow: 1 },
  reglage: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  centre: { textAlign: 'center' },
});
