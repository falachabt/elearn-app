import BottomSheet, { BottomSheetBackdrop, BottomSheetView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTraduction } from '@/i18n/useTraduction';
import type { EtatMiseAJour } from '@/services/miseAJour';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Apparition } from './Apparition';
import { Banniere } from './Banniere';
import { Bouton } from './Bouton';
import { Carte } from './Carte';
import { Rebond } from './Rebond';
import { useReduireAnimations } from './useReduireAnimations';

export type PropsMiseAJour = {
  etat: EtatMiseAJour;
  obligatoire?: boolean;
  onInstaller: () => void;
  onPlusTard: () => void;
};

/** Barre de progression indéterminée (le téléchargement OTA ne donne pas de pourcentage). */
function BarreTelechargement({ libelle }: { libelle: string }) {
  const { theme } = useTheme();
  const reduit = useReduireAnimations();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = reduit ? 0.5 : withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reduit, p]);
  const anime = useAnimatedStyle(() => ({ left: `${p.value * 60}%` }));
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={libelle} style={styles.progressionBloc}>
      <View style={[styles.piste, { backgroundColor: theme.fond.creux, borderColor: theme.bord.fort }]}>
        <Animated.View style={[styles.curseur, { backgroundColor: theme.marque.principale, borderColor: theme.bord.fort }, anime]} />
      </View>
      <Text style={[typo.petit, { color: theme.texte.secondaire }]}>{libelle}</Text>
    </View>
  );
}

/** Contenu commun à la feuille et à l'écran obligatoire : titre, texte, état, actions. */
function Contenu({ etat, obligatoire, onInstaller, onPlusTard }: PropsMiseAJour) {
  const { theme } = useTheme();
  const { t } = useTraduction();
  const occupe = etat === 'telechargement' || etat === 'prete';
  return (
    <View style={styles.contenu}>
      <Rebond declencheur={etat === 'prete'} style={[styles.pastille, { backgroundColor: etat === 'erreur' ? theme.etat.erreur : theme.marque.principale, borderColor: theme.bord.fort }]}>
        <Text style={[typo.h2, { color: theme.texte.surCouleur }]}>{etat === 'erreur' ? '!' : etat === 'prete' ? '✓' : '↑'}</Text>
      </Rebond>
      <Text accessibilityRole="header" style={[typo.h2, { color: theme.texte.principal }]}>
        {obligatoire ? t('miseAJour.obligatoireTitre') : t('miseAJour.titre')}
      </Text>
      <Text style={[typo.texte, { color: theme.texte.secondaire }]}>
        {obligatoire ? t('miseAJour.obligatoireTexte') : t('miseAJour.texte')}
      </Text>
      {etat === 'erreur' ? <Banniere ton="erreur" titre={t('miseAJour.erreurTitre')} texte={t('miseAJour.erreurTexte')} /> : null}
      {occupe ? <BarreTelechargement libelle={etat === 'prete' ? t('miseAJour.prete') : t('miseAJour.telechargement')} /> : null}
      {!occupe ? (
        <View style={styles.actions}>
          <Bouton libelle={etat === 'erreur' ? t('miseAJour.reessayer') : t('miseAJour.mettreAJour')} onPress={onInstaller} />
          {!obligatoire ? <Bouton variante="secondaire" libelle={t('miseAJour.plusTard')} onPress={onPlusTard} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function FondFeuille(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="none" opacity={0.45} />;
}

/** Mise à jour obligatoire : plein écran, aucune sortie hors « Mettre à jour ». */
function EcranObligatoire(props: PropsMiseAJour) {
  const { theme } = useTheme();
  const { top, bottom } = useSafeAreaInsets();
  return (
    <View
      accessibilityViewIsModal
      style={[StyleSheet.absoluteFill, styles.plein, { backgroundColor: theme.fond.app, paddingTop: top + espace[8], paddingBottom: bottom + espace[8] }]}
    >
      <Apparition>
        <Carte>
          <Contenu {...props} obligatoire />
        </Carte>
      </Apparition>
    </View>
  );
}

/** Feuille « mise à jour disponible » (bottom sheet) ; plein écran sans « Plus tard » si `obligatoire`. */
export function FeuilleMiseAJour({ etat, obligatoire = false, onInstaller, onPlusTard }: PropsMiseAJour) {
  const { theme } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const feuille = useRef<BottomSheet>(null);

  if (etat === 'aucune') return null;
  if (obligatoire) return <EcranObligatoire etat={etat} obligatoire onInstaller={onInstaller} onPlusTard={onPlusTard} />;

  const fermable = etat === 'disponible' || etat === 'erreur';
  return (
    <BottomSheet
      ref={feuille}
      index={0}
      enableDynamicSizing
      enablePanDownToClose={fermable}
      enableContentPanningGesture={fermable}
      enableHandlePanningGesture={fermable}
      backdropComponent={FondFeuille}
      onClose={onPlusTard}
      handleIndicatorStyle={{ backgroundColor: theme.bord.fort }}
      backgroundStyle={{ backgroundColor: theme.fond.surface, borderColor: theme.bord.fort, borderWidth: bord.normal, borderRadius: rayon.l }}
    >
      <BottomSheetView style={{ paddingBottom: bottom + espace[5], paddingHorizontal: espace[5] }}>
        <Contenu etat={etat} onInstaller={onInstaller} onPlusTard={() => feuille.current?.close()} />
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  contenu: { gap: espace[4] },
  pastille: { width: 48, height: 48, borderRadius: rayon.pilule, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: espace[4], paddingRight: 0 },
  plein: { justifyContent: 'center', paddingHorizontal: espace[5], zIndex: 1000 },
  progressionBloc: { gap: espace[3] },
  piste: { height: 16, borderWidth: bord.normal, borderRadius: rayon.pilule, overflow: 'hidden' },
  curseur: { position: 'absolute', top: 0, bottom: 0, width: '40%', borderWidth: bord.fin, borderRadius: rayon.pilule },
});
