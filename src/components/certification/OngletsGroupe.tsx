import { Check, TriangleAlert } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import type { QuestionServie } from '@/services/certification/types';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';

type Props = {
  membres: QuestionServie[];
  /** Réponses déjà données dans le groupe (une clé par question, `null` = passée). */
  reponses: Record<string, number | null>;
  selection: number;
  onChoisir: (i: number) => void;
  /** Après validation avec correction (Entraînement, v31) : `true` = juste (vert), `false` = faux (rouge), une clé par question. */
  corrections?: Record<string, boolean>;
};

/**
 * Onglets d'un groupe : un par question, numéro seul (v32), en colonnes égales qui tiennent sur une ligne dès 360 px (v31).
 * Onglet actif en noir. Avant validation, une coche marque la question répondue ; après validation, l'onglet passe en vert
 * (juste, coche) ou en rouge (faux, alerte). Jamais la couleur seule : l'icône et le libellé d'accessibilité le disent.
 */
export function OngletsGroupe({ membres, reponses, selection, onChoisir, corrections }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  return (
    <View accessibilityRole="tablist" style={styles.rangee}>
      {membres.map((m, i) => {
        const actif = i === selection;
        const correction = corrections?.[m.id];
        const fait = m.id in reponses;
        const numero = m.number ?? i + 1;
        const libelle = t('certification.exercice.question', { n: numero });
        const etat = correction === undefined ? null : correction ? t('certification.exercice.juste') : t('certification.exercice.faux');
        const fond = actif ? theme.texte.principal : correction === true ? theme.etat.succesDoux : correction === false ? theme.etat.erreur : theme.fond.surface;
        const encre = actif ? theme.texte.inverse : theme.texte.principal;
        return (
          <Appui
            key={m.id}
            style={styles.case}
            accessibilityRole="tab"
            accessibilityState={{ selected: actif }}
            accessibilityLabel={etat ? `${libelle}, ${etat}` : libelle}
            onPress={() => onChoisir(i)}
            decalage={0}
            rayon={rayon.m}
          >
            <View style={[styles.onglet, { backgroundColor: fond, borderColor: theme.bord.fort }]}>
              {correction === true ? <Check size={14} color={encre} strokeWidth={2.5} /> : null}
              {correction === false ? <TriangleAlert size={14} color={encre} strokeWidth={2.5} /> : null}
              {correction === undefined && fait ? <Check size={14} color={encre} strokeWidth={2.5} /> : null}
              <Text style={[typo.boutonPetit, { color: encre }]}>{numero}</Text>
            </View>
          </Appui>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Colonnes égales, jamais de retour à la ligne : 3 onglets de 104 px à 360 px, 5 onglets de 59 px sans défilement latéral.
  rangee: { flexDirection: 'row', gap: espace[3] },
  case: { flex: 1, minWidth: 0 },
  onglet: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: espace[1], paddingHorizontal: espace[1], borderWidth: bord.normal, borderRadius: rayon.m },
});
