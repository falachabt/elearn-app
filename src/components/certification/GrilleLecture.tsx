import { Check, Minus } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';
import { GrilleEgale } from './ui';

export type CaseLecture = { index: number; numero: number | null; repondue: boolean };

type Props = {
  cases: CaseLecture[];
  /** Index (dans le test) de la question affichée : sa case reçoit le contour épais. */
  courant: number;
  onChoisir: (index: number) => void;
};

/**
 * Grille de la Lecture en navigation libre (maquette du 16 novembre 2026) : un bloc de dix questions autour de la
 * question en cours. Répondue = coche sur fond vert, sans réponse = tiret : jamais la seule couleur.
 */
export function GrilleLecture({ cases, courant, onChoisir }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const rendu = cases.map((c) => {
    const actif = c.index === courant;
    const etat = actif ? 'courante' : c.repondue ? 'repondue' : 'sans';
    const libelle = t(`certification.examen.libre.grille_${etat}`, { n: c.numero ?? c.index + 1 });
    const fond = c.repondue ? theme.etat.succes : theme.fond.surface;
    const Icone = c.repondue ? Check : Minus;
    return (
      <Appui key={c.index} accessibilityRole="button" accessibilityLabel={libelle} accessibilityState={{ selected: actif }} onPress={() => onChoisir(c.index)} decalage={0} rayon={rayon.s}>
        <View style={[styles.case, { backgroundColor: fond, borderColor: theme.bord.fort, borderWidth: actif ? bord.epais : bord.normal }]}>
          <Icone size={12} color={c.repondue ? theme.texte.surCouleur : theme.texte.secondaire} strokeWidth={2.5} />
          <Text style={[typo.legende, { color: c.repondue ? theme.texte.surCouleur : theme.texte.principal }]}>{c.numero ?? c.index + 1}</Text>
        </View>
      </Appui>
    );
  });
  return <GrilleEgale colonnes={5} enfants={rendu} />;
}

const styles = StyleSheet.create({
  case: { minHeight: cibleMin, alignItems: 'center', justifyContent: 'center', gap: espace[1], borderRadius: rayon.s },
});
