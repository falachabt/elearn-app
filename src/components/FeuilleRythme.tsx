import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { bornerTaille, enregistrerRythme, PAS_TAILLE, RYTHMES, TAILLE_DEFAUT, TAILLE_MAX, TAILLE_MIN } from '@/services/rythme';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

import { Bouton } from './Bouton';
import { Feuille } from './Feuille';

type Props = {
  ouverte: boolean;
  onFermer: () => void;
  /** Taille déjà choisie, pour la modifier depuis les réglages. */
  actuelle?: number | null;
  source: 'fin_mission' | 'parametres';
  onChoisi?: (n: number) => void;
};

/**
 * Rythme de la mission du jour : le temps qu'on est prêt à y passer donne un nombre de questions (15 à 30),
 * que l'élève ajuste lui-même avant de valider.
 */
export function FeuilleRythme({ ouverte, onFermer, actuelle, source, onChoisi }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [taille, setTaille] = useState(actuelle ?? TAILLE_DEFAUT);
  // Repart de la taille enregistrée à chaque ouverture (état dérivé pendant le rendu, sans effet).
  const [ouverteAvant, setOuverteAvant] = useState(ouverte);
  if (ouverte !== ouverteAvant) {
    setOuverteAvant(ouverte);
    if (ouverte) setTaille(actuelle ?? TAILLE_DEFAUT);
  }

  const valider = async () => {
    const n = await enregistrerRythme(taille);
    suivre('mission_size_chosen', { questions: n, source });
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
      <View accessibilityRole="radiogroup" style={styles.ligne}>
        {RYTHMES.map((r) => (
          <View key={r.minutes} style={styles.choix}>
            <Bouton
              petit
              variante={taille === r.questions ? 'primaire' : 'secondaire'}
              libelle={t('rythme.minutes', { n: r.minutes })}
              onPress={() => setTaille(r.questions)}
            />
          </View>
        ))}
      </View>
      <View style={styles.reglage}>
        <Bouton petit variante="secondaire" libelle="−" accessibilityLabel={t('rythme.moins')} desactive={taille <= TAILLE_MIN} onPress={() => setTaille(bornerTaille(taille - PAS_TAILLE))} />
        <Text accessibilityLiveRegion="polite" style={[typo.h3, styles.nombre, { color: theme.texte.principal }]}>{t('rythme.questions', { n: taille })}</Text>
        <Bouton petit variante="secondaire" libelle="+" accessibilityLabel={t('rythme.plus')} desactive={taille >= TAILLE_MAX} onPress={() => setTaille(bornerTaille(taille + PAS_TAILLE))} />
      </View>
    </Feuille>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', gap: espace[3] },
  choix: { flex: 1 },
  reglage: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  nombre: { flex: 1, textAlign: 'center' },
});
