import BottomSheet, { BottomSheetBackdrop, BottomSheetView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { forwardRef, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CleTexte } from '@/i18n';
import { useTraduction } from '@/i18n/useTraduction';
import { lireCodeValide } from '@/services/parrainage';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { MentionsLegales } from '../MentionsLegales';
import { Bouton } from '../Bouton';
import { BoutonsSociaux } from '../BoutonsSociaux';

function Fond(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" opacity={0.45} />;
}

type Props = {
  onSauvegarde: () => void;
  onFermee?: () => void;
};

/** Contenu de A6 (séparé de la feuille pour les tests) : Google, Apple, Facebook, e-mail, « Plus tard » (M2-05). */
export function ContenuSauvegarde({ onSauvegarde, onPlusTard }: { onSauvegarde: () => void; onPlusTard: () => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [erreur, setErreur] = useState<CleTexte | null>(null);
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    lireCodeValide()
      .then(setCode)
      .catch(() => {});
  }, []);
  return (
    <View style={styles.contenu}>
      <Text accessibilityRole="header" style={[typo.h2, { color: theme.texte.principal }]}>{t('sauvegarde.titre')}</Text>
      <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('sauvegarde.texte')}</Text>
      {erreur ? <Banniere ton="erreur" titre={t(erreur)} /> : null}
      <BoutonsSociaux codeParrainage={code} onErreur={setErreur} onSucces={onSauvegarde} />
      <Bouton
        variante="texte"
        libelle={t('sauvegarde.email')}
        onPress={() => {
          onPlusTard();
          router.push('/compte/creer');
        }}
      />
      <Bouton variante="texte" libelle={t('sauvegarde.plusTard')} onPress={onPlusTard} />
      <MentionsLegales />
    </View>
  );
}

/** A6 · Sauvegarder : feuille par-dessus le score, fermable d'un glissement ou par « Plus tard ». */
export const FeuilleSauvegarde = forwardRef<BottomSheet, Props>(function FeuilleSauvegarde({ onSauvegarde, onFermee }, ref) {
  const { theme } = useTheme();
  const { top, bottom } = useSafeAreaInsets();
  const fermer = () => (ref && 'current' in ref ? ref.current?.close() : undefined);
  return (
    <BottomSheet
      ref={ref}
      index={-1}
      enableDynamicSizing
      topInset={top}
      enablePanDownToClose
      backdropComponent={Fond}
      onClose={onFermee}
      handleIndicatorStyle={{ backgroundColor: theme.bord.fort }}
      backgroundStyle={{ backgroundColor: theme.fond.surface, borderColor: theme.bord.fort, borderWidth: bord.normal, borderRadius: rayon.l }}
    >
      <BottomSheetView style={{ paddingBottom: bottom + espace[5], paddingHorizontal: espace[5] }}>
        <ContenuSauvegarde
          onPlusTard={fermer}
          onSauvegarde={() => {
            fermer();
            onSauvegarde();
          }}
        />
      </BottomSheetView>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  contenu: { gap: espace[4] },
  centre: { textAlign: 'center' },
});
