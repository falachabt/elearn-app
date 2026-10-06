import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

import { useTraduction } from '@/i18n/useTraduction';
import { contenuHorsLigneValide } from '@/services/connectivite';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon } from '@/theme/theme';

import { Feuille } from '../Feuille';
import { useReduireAnimations } from '../useReduireAnimations';
import { useReseau } from './useReseau';

/** Durée d'un passage du reflet : assez lent pour rester discret. */
const DUREE_REFLE = 1400;
/** Marge de touche autour de la pastille (42 px visuels, ~54 px touchables). */
const MARGE_TOUCHE = 6;
/** Diamètre de la pastille : assez grand pour se voir et se toucher, sans masquer la liste dessous. */
const PASTILLE = 42;

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
  /** Vrai quand le contenu hors ligne a dépassé sa durée de validité (7 jours sans contact serveur). */
  const [expire, setExpire] = useState(false);

  // Issue #13 (option A) : le contenu gardé sur l'appareil ne vaut que 7 jours. Passé ce délai sans contact serveur,
  // on le dit et on demande une reconnexion — c'est ce passage qui synchronise les crédits en attente.
  //
  // Le `setState` est posé dans le callback de la promesse, jamais dans le corps de l'effet (règle
  // `react-hooks/set-state-in-effect` : un état posé synchroniquement enchaîne les rendus).
  useEffect(() => {
    let actif = true;
    void contenuHorsLigneValide().then((valide) => {
      if (actif) setExpire(!valide);
    });
    return () => {
      actif = false;
    };
  }, [estEnLigne]);

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
  const teinte = expire ? theme.etat.erreur : theme.etat.alerte;
  const fond = expire ? theme.etat.erreurDoux : theme.etat.alerteDoux;

  return (
    <>
      <View style={styles.zone}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('reseau.voir')}
          hitSlop={MARGE_TOUCHE}
          onPress={() => setOuverte(true)}
          style={[styles.pastille, { backgroundColor: fond, borderColor: teinte }]}
        >
          <Ionicons name={expire ? 'alert-circle-outline' : 'cloud-offline-outline'} size={20} color={teinte} />
        </Pressable>
        <View accessibilityLabel={t('reseau.horsLigne')} style={[styles.barre, { backgroundColor: teinte }]}>
          {enVerification && !reduit ? <Animated.View style={[styles.reflet, { backgroundColor: theme.fond.surface }, anime]} /> : null}
        </View>
      </View>
      <Feuille
        ouverte={ouverte}
        onFermer={() => setOuverte(false)}
        icone={expire ? 'alert-circle-outline' : 'cloud-offline-outline'}
        titre={expire ? t('reseau.expireTitre') : t('reseau.horsLigne')}
        texte={expire ? t('reseau.expireTexte') : t('reseau.horsLigneTexte')}
        mention={!expire && enVerification ? t('reseau.verification') : undefined}
        actions={[{ libelle: t('reseau.compris'), onPress: () => setOuverte(false) }]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Aucun `zIndex` ni `elevation` ici : la zone est dessinée avant la barre d'onglets, donc l'ordre naturel suffit.
  // Avec un `zIndex`, la barre passait au-dessus du bouton central (appareil photo) de la barre d'onglets.
  zone: { width: '100%' },
  // Pastille posée juste au-dessus de la barre, décalée vers le haut pour ne plus être recouverte.
  // Pas d'ombre portée non plus : `elevation` la ferait repasser devant la barre d'onglets sur Android.
  pastille: {
    position: 'absolute',
    left: espace[5],
    top: -(PASTILLE - 2),
    width: PASTILLE,
    height: PASTILLE,
    borderRadius: rayon.pilule,
    borderWidth: bord.fin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barre: { height: 3, width: '100%', overflow: 'hidden' },
  reflet: { position: 'absolute', top: 0, bottom: 0, width: 60, opacity: 0.55 },
});
