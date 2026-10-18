import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { chargerAccueil } from '@/services/certification/accueil';
import { lirePlan } from '@/services/certification/etat';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Bouton } from '../Bouton';
import { Carte } from '../Carte';
import { BarreProgression } from './ui';
import { useChargement } from './useChargement';

/** « Progression vers ton objectif » : visé, estimé et écart, à la place de la carte XP de Moi (maquette TOEIC-N2). */
export function ProgressionToeic() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { etat } = useChargement(lirePlan);
  const accueil = useChargement(chargerAccueil);
  const score = accueil.etat.phase === 'ok' ? accueil.etat.valeur.score : null;
  const plan = etat.phase === 'ok' ? etat.valeur : null;
  const objectif = plan?.objectif ?? null;
  // L'écart n'existe que si le score estimé et l'objectif sont connus : sinon pas de chiffre inventé.
  const ecart = score !== null && objectif !== null ? score - objectif : null;
  const pourcent = score !== null && objectif ? (score / objectif) * 100 : 0;
  const tuiles = [
    { titre: t('certification.moiToeic.progressionVise'), aide: objectif !== null ? String(objectif) : t('certification.moiToeic.objectifVide') },
    { titre: t('certification.moiToeic.progressionEstime'), aide: score !== null ? t('certification.accueilToeic.scoreExact', { score }) : t('certification.moiToeic.progressionPas') },
    { titre: t('certification.moiToeic.progressionEcart'), aide: ecart !== null ? t('certification.moiToeic.progressionEcartAide', { n: ecart }) : t('certification.moiToeic.progressionPas') },
  ];
  return (
    <Carte>
      <View style={styles.contenu}>
        <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('certification.moiToeic.progressionEtiquette')}</Text>
        <View style={styles.grille}>
          {tuiles.map((tuile) => (
            <View key={tuile.titre} style={[styles.tuile, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{tuile.titre}</Text>
              <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{tuile.aide}</Text>
            </View>
          ))}
        </View>
        <BarreProgression pourcent={pourcent} libelle={t('certification.moiToeic.progressionEtiquette')} />
        <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{t('certification.moiToeic.progressionNote')}</Text>
        <Bouton petit variante="texte" libelle={t('certification.moiToeic.progressionStatistiques')} onPress={() => router.push('/statistiques')} />
      </View>
    </Carte>
  );
}

// Trois tuiles directes dans la rangée (pas d'enveloppe en pourcentage ni de rétrécissement) : sur téléphone la rangée
// garde sa hauteur naturelle et les tuiles se partagent la largeur. minWidth 0 laisse le libellé passer à la ligne.
// Espace vertical entre l'étiquette, les tuiles, la barre et la phrase : rien ne se touche.
const styles = StyleSheet.create({
  contenu: { gap: espace[3] },
  grille: { flexDirection: 'row', gap: espace[2], alignItems: 'stretch' },
  tuile: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    padding: espace[4],
    borderWidth: bord.normal,
    borderRadius: rayon.m,
    minHeight: 64,
    justifyContent: 'center',
  },
});
