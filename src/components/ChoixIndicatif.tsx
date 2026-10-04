import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, rayon, typo } from '@/theme/theme';

import { Appui } from './Appui';

/** Indicatifs proposés : Afrique francophone d'abord, puis la diaspora. */
export const INDICATIFS_MONDE = [
  ['CM', '237'], ['CI', '225'], ['SN', '221'], ['GA', '241'], ['BF', '226'], ['CD', '243'], ['CG', '242'], ['BJ', '229'],
  ['TG', '228'], ['ML', '223'], ['NE', '227'], ['GN', '224'], ['TD', '235'], ['CF', '236'], ['GQ', '240'], ['NG', '234'],
  ['FR', '33'], ['BE', '32'], ['CH', '41'], ['CA', '1'], ['US', '1'], ['GB', '44'], ['DE', '49'],
] as const;
type CodePays = (typeof INDICATIFS_MONDE)[number][0];

/**
 * Indicatif téléphonique modifiable, collé à gauche d'un `Champ` (via `prefixe`) : le pays de l'élève par défaut, mais
 * son parent peut vivre ailleurs.
 */
export function ChoixIndicatif({ valeur, onChange }: { valeur: string; onChange: (indicatif: string) => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <Appui accessibilityRole="button" accessibilityLabel={t('indicatifs.changer', { code: valeur })} onPress={() => setOuvert(true)} decalage={0} rayon={rayon.m}>
        <View style={[styles.bouton, { borderColor: theme.bord.fort, backgroundColor: theme.fond.creux }]}>
          <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{`+${valeur}`}</Text>
          <Ionicons name="chevron-down" size={16} color={theme.texte.principal} />
        </View>
      </Appui>
      <Modal visible={ouvert} transparent animationType="slide" onRequestClose={() => setOuvert(false)}>
        <Pressable accessibilityLabel={t('indicatifs.fermer')} style={styles.fond} onPress={() => setOuvert(false)} />
        <View style={[styles.panneau, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort, paddingBottom: bottom + espace[5] }]}>
          <Text accessibilityRole="header" style={[typo.h3, styles.titre, { color: theme.texte.principal }]}>{t('indicatifs.titre')}</Text>
          <FlatList
            data={INDICATIFS_MONDE}
            keyExtractor={([pays]) => pays}
            renderItem={({ item: [pays, code] }) => {
              const choisi = code === valeur;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: choisi }}
                  onPress={() => {
                    onChange(code);
                    setOuvert(false);
                  }}
                  style={[styles.ligne, choisi && { backgroundColor: theme.marque.douce }]}
                >
                  <Text style={[typo.texte, styles.flex, { color: theme.texte.principal }]}>{t(`indicatifs.pays.${pays as CodePays}`)}</Text>
                  <Text style={[typo.texteFort, { color: theme.texte.principal }]}>{`+${code}`}</Text>
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bouton: { minHeight: cibleMin, flexDirection: 'row', alignItems: 'center', gap: espace[2], paddingHorizontal: espace[4], borderWidth: bord.normal, borderRadius: rayon.m },
  fond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  panneau: { maxHeight: '70%', borderTopLeftRadius: rayon.l, borderTopRightRadius: rayon.l, borderWidth: bord.normal, paddingTop: espace[5] },
  titre: { paddingHorizontal: espace[5], paddingBottom: espace[3] },
  ligne: { minHeight: cibleMin, flexDirection: 'row', alignItems: 'center', gap: espace[4], paddingHorizontal: espace[5] },
  flex: { flex: 1 },
});
