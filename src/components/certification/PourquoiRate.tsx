import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, typo } from '@/theme/theme';

import { Feuille } from '../Feuille';
import { GroupeColle } from '../liste/ListeCollee';

type Raison = 'mot' | 'regle' | 'lu' | 'vite';

type Props = {
  ouverte: boolean;
  onFermer: () => void;
  onChoisir: (raison: Raison) => void;
};

/**
 * B10 · « Pourquoi j'ai raté ? » : une touche par raison, sans effet sur le score. Chaque ligne fait l'action qui existe
 * déjà (carnet, notion, question, rejeu) ; la raison n'est pas enregistrée côté serveur.
 */
export function PourquoiRate({ ouverte, onFermer, onChoisir }: Props) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const lignes: { raison: Raison; titre: string; action: string }[] = [
    { raison: 'mot', titre: t('certification.explication.pourquoiMot'), action: t('certification.explication.pourquoiMotAction') },
    { raison: 'regle', titre: t('certification.explication.pourquoiRegle'), action: t('certification.explication.pourquoiRegleAction') },
    { raison: 'lu', titre: t('certification.explication.pourquoiLu'), action: t('certification.explication.pourquoiLuAction') },
    { raison: 'vite', titre: t('certification.explication.pourquoiVite'), action: t('certification.explication.pourquoiViteAction') },
  ];
  return (
    <Feuille ouverte={ouverte} onFermer={onFermer} titre={t('certification.explication.pourquoi')} texte={t('certification.explication.pourquoiIndice')} actions={[]}>
      <View style={styles.liste}>
        {/* Quatre raisons sans hiérarchie propre : un seul bloc collé, un trait fin entre les lignes. */}
        <GroupeColle>
          {lignes.map((l, i) => (
            <Pressable
              key={l.raison}
              accessibilityRole="button"
              accessibilityLabel={`${l.titre}, ${l.action}`}
              onPress={() => onChoisir(l.raison)}
              style={({ pressed }) => [
                styles.ligne,
                i > 0 && { borderTopWidth: bord.fin, borderTopColor: theme.bord.doux },
                { backgroundColor: theme.fond.surface, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{l.titre}</Text>
              <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{l.action}</Text>
            </Pressable>
          ))}
        </GroupeColle>
        <Pressable accessibilityRole="button" onPress={onFermer} style={styles.passer}>
          <Text style={[typo.boutonPetit, { color: theme.texte.principal }]}>{t('certification.explication.pourquoiPasser')}</Text>
        </Pressable>
      </View>
    </Feuille>
  );
}

const styles = StyleSheet.create({
  liste: { gap: espace[3] },
  ligne: { minHeight: 48, padding: espace[4], gap: espace[1] },
  passer: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
