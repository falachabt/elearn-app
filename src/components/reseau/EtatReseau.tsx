import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon } from '@/theme/theme';

import { Feuille } from '../Feuille';
import { useReduireAnimations } from '../useReduireAnimations';
import { useReseau } from './useReseau';

/** Durée d'un passage du reflet : assez lent pour rester discret. */
const DUREE_REFLE = 1400;
/** Marge de touche autour de la pastille (22 px visuels, ~34 px touchables). */
const MARGE_TOUCHE = 6;

/**
 * Indicateur hors ligne (issue #25). Version discrète, posée juste au-dessus de la barre d'onglets :
 *
 * - une barre fine en teinte d'alerte, avec un reflet qui balaie tant qu'une vérification est en cours ;
 * - une pastille au coin gauche ; un appui ouvre une feuille qui explique le mode hors ligne.
 *
 * Rien n'est affiché en ligne : il n'y a rien à signaler, et une barre permanente serait du bruit. La barre ne
 * prétend jamais être en ligne : elle apparaît dès qu'une sonde a échoué, même si l'appareil a une interface réseau.
 */
export function EtatReseau() {
  const { estEnLigne, enVerification } = useReseau();
  const { t } = useTraduction();
  const { theme } = useTheme();
  const reduit = useReduireAnimations();
  const [ouverte, setOuverte] = useState(false);

  const reflet = useSharedValue(-1);
  useEffect(() => {
    if (!enVerification || reduit) {
      cancelAnimation(reflet);
      reflet.value = -1;
      return;
    }
    reflet.value = withRepeat(withDelay(DUREE_REFLE, withTiming(1, { duration: DUREE_REFLE })), -1, false);
  }, [enVerification, reduit, reflet]);
  const anime = useAnimatedStyle(() => ({ transform: [{ translateX: reflet.value * 160 }] }));

  if (estEnLigne) return null;
  const teinte = theme.etat.alerte;

  return (
    <>
      <View style={styles.zone}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('reseau.voir')}
          hitSlop={MARGE_TOUCHE}
          onPress={() => setOuverte(true)}
          style={[styles.pastille, { backgroundColor: theme.etat.alerteDoux, borderColor: teinte }]}
        >
          <Ionicons name="cloud-offline-outline" size={16} color={teinte} />
        </Pressable>
        <View accessibilityLabel={t('reseau.horsLigne')} style={[styles.barre, { backgroundColor: teinte }]}>
          {enVerification && !reduit ? <Animated.View style={[styles.reflet, { backgroundColor: theme.fond.surface }, anime]} /> : null}
        </View>
      </View>
      <Feuille
        ouverte={ouverte}
        onFermer={() => setOuverte(false)}
        icone="cloud-offline-outline"
        titre={t('reseau.horsLigne')}
        texte={t('reseau.horsLigneTexte')}
        mention={enVerification ? t('reseau.verification') : undefined}
        actions={[{ libelle: t('reseau.compris'), onPress: () => setOuverte(false) }]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  zone: { width: '100%' },
  // Pastille de 22 px posée au-dessus de la barre : discrète, agrandie au toucher par `hitSlop`.
  pastille: {
    position: 'absolute',
    left: espace[5],
    top: -26,
    width: 22,
    height: 22,
    borderRadius: rayon.pilule,
    borderWidth: bord.fin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barre: { height: 3, width: '100%', overflow: 'hidden' },
  reflet: { position: 'absolute', top: 0, bottom: 0, width: 60, opacity: 0.55 },
});
