import { StyleSheet, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { espace } from '@/theme/theme';

import { Banniere } from '../Banniere';
import { useReseau } from './useReseau';

/**
 * Indicateur en ligne / hors ligne (issue #25), posé au-dessus des onglets.
 *
 * Il n'apparaît que hors ligne : en ligne il n'y a rien à signaler, et une pastille permanente serait du bruit.
 * Il réagit à la perte comme au retour du réseau, et reste faux quand le serveur est injoignable alors que
 * l'interface réseau est active.
 */
export function EtatReseau() {
  const { estEnLigne } = useReseau();
  const { t } = useTraduction();

  if (estEnLigne) return null;

  return (
    <View accessibilityRole="alert" style={styles.zone} pointerEvents="box-none">
      <Banniere ton="alerte" titre={t('reseau.horsLigne')} texte={t('reseau.horsLigneTexte')} />
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { position: 'absolute', left: espace[5], right: espace[5], top: espace[5], zIndex: 10 },
});
