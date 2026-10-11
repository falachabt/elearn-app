import { BottomSheetBackdrop, BottomSheetFlatList, BottomSheetModal, BottomSheetTextInput, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import { Search } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTraduction } from '@/i18n/useTraduction';
import type { PaysPaiement } from '@/services/paiementPass';
import { ALPHA3, INDICATIFS_MONDE } from '@/services/paysCodes';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';

function Fond(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" opacity={0.45} />;
}

/** Sans accents ni majuscules : « cote d'ivoire » trouve « Côte d’Ivoire ». */
export const normaliser = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ').toLowerCase().trim();

/**
 * Pays qui correspondent à la saisie. On doit pouvoir y arriver par le nom (« Cameroun »), le code à deux lettres
 * (« CM »), le code à trois lettres (« CMR », « CIV ») ou l'indicatif téléphonique (« 237 », « +237 »). Vide : tous.
 *
 * Les résultats sont classés : le code exact d'abord (« CI » sort la Côte d'Ivoire avant la Cité du Vatican), puis
 * l'indicatif exact, puis le nom commençant par la saisie, et enfin les correspondances au milieu du nom.
 */
export function filtrerPays(liste: PaysPaiement[], saisie: string): PaysPaiement[] {
  const q = normaliser(saisie);
  if (!q) return liste;
  const chiffres = q.replace(/\D/g, '');

  const rang = (p: PaysPaiement): number => {
    const code = p.alpha2.toLowerCase();
    const alpha3 = (ALPHA3[p.alpha2] ?? '').toLowerCase();
    const indicatif = (p.prefix || INDICATIFS_MONDE[p.alpha2] || '').replace(/\D/g, '');
    const nom = normaliser(p.name);
    if (code === q || (!!alpha3 && alpha3 === q)) return 0;
    if (!!chiffres && !!indicatif && indicatif === chiffres) return 1;
    if (nom.startsWith(q)) return 2;
    if (!!chiffres && !!indicatif && indicatif.startsWith(chiffres)) return 3;
    if (nom.includes(q)) return 4;
    if (p.currencies.some((d) => d.toLowerCase().includes(q))) return 5;
    return -1;
  };

  return liste
    .map((p) => ({ p, rang: rang(p) }))
    .filter((x) => x.rang >= 0)
    // `sort` est stable : à rang égal, l'ordre alphabétique de la liste est conservé.
    .sort((a, b) => a.rang - b.rang)
    .map((x) => x.p);
}

/**
 * Choix du pays dans une feuille du bas, avec une barre de recherche. La liste défile dans la feuille ; le clavier
 * relève la feuille elle-même (comportement « interactive » de la bibliothèque), sans pousser l'écran derrière.
 */
export function FeuillePays({ ouverte, pays, choisi, onChoisir, onFermer }: { ouverte: boolean; pays: PaysPaiement[] | null; choisi: string | null; onChoisir: (alpha2: string) => void; onFermer: () => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { top, bottom } = useSafeAreaInsets();
  const feuille = useRef<BottomSheetModal>(null);
  const retiree = useRef(false);
  const [saisie, setSaisie] = useState('');

  useEffect(() => {
    if (!ouverte) return;
    retiree.current = false;
    feuille.current?.present();
    return () => {
      retiree.current = true;
    };
  }, [ouverte]);

  const visibles = useMemo(() => filtrerPays(pays ?? [], saisie), [pays, saisie]);
  if (!ouverte) return null;

  return (
    <BottomSheetModal
      ref={feuille}
      snapPoints={['80%']}
      enableDynamicSizing={false}
      topInset={top}
      enablePanDownToClose
      backdropComponent={Fond}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onDismiss={() => {
        if (!retiree.current) onFermer();
      }}
      handleIndicatorStyle={{ backgroundColor: theme.bord.fort }}
      backgroundStyle={{ backgroundColor: theme.fond.surface, borderColor: theme.bord.fort, borderWidth: bord.normal, borderRadius: rayon.l }}
    >
      <View style={styles.tete}>
        <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t('paiement.choisirPays')}</Text>
        <View style={[styles.recherche, { backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}>
          <Search size={18} strokeWidth={2.25} color={theme.texte.secondaire} />
          <BottomSheetTextInput
            value={saisie}
            onChangeText={setSaisie}
            placeholder={t('paiement.rechercherPays')}
            placeholderTextColor={theme.texte.secondaire}
            accessibilityLabel={t('paiement.rechercherPays')}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={[typo.texte, styles.champ, { color: theme.texte.principal }]}
          />
        </View>
      </View>
      {pays === null ? (
        <ActivityIndicator color={theme.marque.principale} style={styles.attente} />
      ) : (
        <BottomSheetFlatList
          data={visibles}
          keyExtractor={(p: PaysPaiement) => p.alpha2}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.liste, { paddingBottom: bottom + espace[5] }]}
          ListEmptyComponent={<Text style={[typo.texte, styles.vide, { color: theme.texte.secondaire }]}>{t('paiement.aucunPays')}</Text>}
          renderItem={({ item }: { item: PaysPaiement }) => {
            const actuel = item.alpha2 === choisi;
            return (
              <Appui accessibilityRole="button" accessibilityState={{ selected: actuel }} accessibilityLabel={item.name} onPress={() => onChoisir(item.alpha2)} rayon={rayon.m} decalage={2}>
                <View style={[styles.ligne, { backgroundColor: actuel ? theme.marque.douce : theme.fond.surface, borderColor: theme.bord.fort, borderWidth: actuel ? 3 : bord.normal }]}>
                  {item.flag ? <Image source={{ uri: item.flag }} style={styles.drapeau} contentFit="cover" accessibilityIgnoresInvertColors /> : <View style={styles.drapeau} />}
                  <Text style={[typo.texteFort, styles.nom, { color: theme.texte.principal }]}>{item.name}</Text>
                  {/* L'indicatif n'est connu que pour les pays du Mobile Money : pas de « + » orphelin ailleurs. */}
                  {item.prefix ? <Text style={[typo.legende, { color: theme.texte.secondaire }]}>{`+${item.prefix}`}</Text> : null}
                </View>
              </Appui>
            );
          }}
        />
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  tete: { gap: espace[3], paddingHorizontal: espace[5], paddingBottom: espace[3] },
  recherche: { flexDirection: 'row', alignItems: 'center', gap: espace[2], minHeight: cibleMin, paddingHorizontal: espace[3], borderWidth: bord.normal, borderRadius: rayon.m },
  champ: { flex: 1, paddingVertical: espace[2] },
  liste: { paddingHorizontal: espace[5], gap: espace[3] },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[3], padding: espace[3], borderRadius: rayon.m },
  drapeau: { width: 32, height: 22, borderRadius: 4 },
  nom: { flex: 1 },
  attente: { marginTop: espace[6] },
  vide: { textAlign: 'center', marginTop: espace[6] },
});
