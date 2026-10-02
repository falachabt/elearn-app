import { useState } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { definirTaille, TAILLES, type TailleTexte } from '@/services/affichage';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, espace, rayon, typo } from '@/theme/theme';

const BOUTON = 22;

/** Index du cran le plus proche d'une position sur le rail. */
export function cranPour(x: number, largeur: number, n = TAILLES.length): number {
  if (largeur <= 0) return 0;
  return Math.max(0, Math.min(n - 1, Math.round((x / largeur) * (n - 1))));
}

/**
 * H2 › Taille du texte : « A » petit, rail à crans (90 à 130 %), « A » grand, valeur en pour cent.
 * Glisser ou toucher le rail ; les lecteurs d'écran l'ajustent cran par cran. Appliqué à toute l'app tout de suite.
 */
export function ReglageTailleTexte() {
  const { t } = useTraduction();
  const { theme, taille } = useTheme();
  const [largeur, setLargeur] = useState(0);
  const index = Math.max(0, TAILLES.indexOf(taille as TailleTexte));

  const choisir = (i: number) => void definirTaille(TAILLES[i]);
  const depuis = (e: GestureResponderEvent) => {
    const i = cranPour(e.nativeEvent.locationX, largeur);
    if (TAILLES[i] !== taille) choisir(i);
  };

  const position = largeur ? (index / (TAILLES.length - 1)) * largeur : 0;
  return (
    <View style={styles.zone}>
      <View style={styles.entete}>
        <Text style={[typo.texteFort, styles.flex, { color: theme.texte.principal }]}>{t('reglages.taille')}</Text>
        <Text style={[typo.donnee, { color: theme.texte.secondaire }]}>{t('reglages.tailleValeur', { n: TAILLES[index] })}</Text>
      </View>
      <View style={styles.ligne}>
        <Text style={[styles.petitA, { color: theme.texte.principal }]}>A</Text>
        <View
          testID="taille-rail"
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t('reglages.taille')}
          accessibilityValue={{ min: TAILLES[0], max: TAILLES[TAILLES.length - 1], now: TAILLES[index], text: t('reglages.tailleValeur', { n: TAILLES[index] }) }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => choisir(Math.max(0, Math.min(TAILLES.length - 1, index + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))}
          onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}
          style={styles.cible}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={depuis}
          onResponderMove={depuis}
        >
          <View pointerEvents="none" style={[styles.rail, { borderColor: theme.bord.fort, backgroundColor: theme.fond.creux }]}>
            <View style={[styles.rempli, { width: position, backgroundColor: theme.marque.principale }]} />
          </View>
          {TAILLES.map((n, i) => (
            <View
              key={n}
              pointerEvents="none"
              style={[styles.cran, { left: largeur ? (i / (TAILLES.length - 1)) * largeur - 1 : 0, backgroundColor: theme.bord.fort }]}
            />
          ))}
          <View pointerEvents="none" style={[styles.bouton, { left: position - BOUTON / 2, borderColor: theme.bord.fort, backgroundColor: theme.fond.surface }]} />
        </View>
        <Text style={[styles.grandA, { color: theme.texte.principal }]}>A</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { gap: espace[3] },
  entete: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  flex: { flex: 1 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[4] },
  // Tailles fixes : les deux « A » montrent l'écart, ils ne suivent pas le réglage.
  petitA: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 13, lineHeight: 18 },
  grandA: { fontFamily: 'ArchivoBlack', fontSize: 22, lineHeight: 26 },
  cible: { flex: 1, height: cibleMin, justifyContent: 'center', marginHorizontal: BOUTON / 2 },
  rail: { height: 10, borderWidth: bord.normal, borderRadius: rayon.pilule, overflow: 'hidden' },
  rempli: { height: '100%' },
  cran: { position: 'absolute', width: 2, height: 4, top: cibleMin / 2 + 8 },
  bouton: { position: 'absolute', width: BOUTON, height: BOUTON, borderRadius: rayon.pilule, borderWidth: bord.normal, top: (cibleMin - BOUTON) / 2 },
});
