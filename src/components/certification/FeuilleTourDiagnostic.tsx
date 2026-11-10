import { Files, Layers } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import type { MomentTourDiagnostic } from '@/services/certification/tourDiagnostic';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Feuille } from '../Feuille';

/** Une explication de la feuille : numéro en pastille jaune soleil (même langage que la carte de visite), titre + texte. */
function Explication({ numero, titre, texte }: { numero: number; titre: string; texte: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.explication}>
      <View style={[styles.numero, { backgroundColor: theme.accent.soleil, borderColor: theme.bord.fort }]}>
        <Text style={[typo.texteFort, { color: theme.texte.surCouleur }]}>{numero}</Text>
      </View>
      <View style={styles.explicationTextes}>
        <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{titre}</Text>
        <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{texte}</Text>
      </View>
    </View>
  );
}

/**
 * #123 · Tour de première fois du diagnostic : la feuille qui se présente une seule fois par appareil, au premier
 * groupe audio (mécanique des groupes), puis à la première partie 7 multi-documents (questions et documents
 * multiples). Même habillage `Feuille` aux deux moments ; le drapeau du moment se pose à la fermeture (parent).
 */
export function FeuilleTourDiagnostic({ moment, nombre, onFermer }: { moment: MomentTourDiagnostic | null; nombre: number; onFermer: () => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const audio = moment !== 'partie7';
  return (
    <Feuille
      ouverte={moment !== null}
      onFermer={onFermer}
      icone={audio ? <Layers size={24} color={theme.texte.surCouleur} /> : <Files size={24} color={theme.texte.surCouleur} />}
      titre={audio ? t('certification.tour.audio.titre') : t('certification.tour.partie7.titre')}
      texte={audio ? t('certification.tour.audio.intro', { n: nombre }) : t('certification.tour.partie7.intro', { n: nombre })}
      actions={[{ libelle: t('certification.tour.bouton'), onPress: onFermer }]}
    >
      {audio ? (
        <>
          <Explication numero={1} titre={t('certification.tour.audio.reponseTitre')} texte={t('certification.tour.audio.reponseTexte')} />
          <Explication numero={2} titre={t('certification.tour.audio.avanceTitre')} texte={t('certification.tour.audio.avanceTexte')} />
          <Explication numero={3} titre={t('certification.tour.audio.retourTitre')} texte={t('certification.tour.audio.retourTexte')} />
        </>
      ) : (
        <>
          <Explication numero={1} titre={t('certification.tour.partie7.questionsTitre')} texte={t('certification.tour.partie7.questionsTexte')} />
          <Explication numero={2} titre={t('certification.tour.partie7.documentsTitre')} texte={t('certification.tour.partie7.documentsTexte')} />
        </>
      )}
    </Feuille>
  );
}

const styles = StyleSheet.create({
  explication: { flexDirection: 'row', gap: espace[3] },
  numero: { width: 32, height: 32, borderRadius: rayon.pilule, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  explicationTextes: { flex: 1, gap: espace[1] },
});
