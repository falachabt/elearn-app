import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Bouton } from '../../Bouton';

const ETAPES = ['photographier', 'verifier', 'envoyer'] as const;

/**
 * AS5d · Visite guidée de la prise de photos, montrée une seule fois : trois cartes, « Passer » ou « Compris » la ferme.
 * `onFin(terminee)` : le parent marque la visite comme vue et la retire.
 */
export function VisiteTravail({ onFin }: { onFin: (terminee: boolean) => void }) {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const [i, setI] = useState(0);
  const dernier = i === ETAPES.length - 1;
  const cle = ETAPES[i];

  return (
    <View accessibilityViewIsModal accessibilityLiveRegion="polite" style={styles.voile}>
      <View style={styles.zone}>
        <View style={[styles.ombre, { backgroundColor: theme.ombre }]} />
        <View style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          <Text style={[typo.etiquette, { color: theme.texte.secondaire }]}>{t('travail.visiteEtape', { n: i + 1, total: ETAPES.length })}</Text>
          <View style={styles.reperes}>
            {ETAPES.map((e, k) => (
              <View key={e} style={[styles.repere, { borderColor: theme.bord.fort, backgroundColor: k <= i ? theme.marque.principale : 'transparent' }]} />
            ))}
          </View>
          <Text accessibilityRole="header" style={[typo.h3, { color: theme.texte.principal }]}>{t(`travail.visite.${cle}.titre`)}</Text>
          <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t(`travail.visite.${cle}.texte`)}</Text>
          <View style={styles.actions}>
            {dernier ? null : (
              <View>
                <Bouton variante="texte" libelle={t('travail.visitePasser')} onPress={() => onFin(false)} />
              </View>
            )}
            <View style={styles.flex}>
              <Bouton libelle={t(dernier ? 'travail.visiteCompris' : 'travail.visiteSuivant')} onPress={() => (dernier ? onFin(true) : setI(i + 1))} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  voile: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(10,10,10,0.82)', justifyContent: 'flex-end', padding: espace[5] },
  zone: { paddingBottom: ombre.carte, paddingRight: ombre.carte },
  ombre: { position: 'absolute', left: ombre.carte, top: ombre.carte, right: 0, bottom: 0, borderRadius: rayon.l },
  carte: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[5], gap: espace[3] },
  reperes: { flexDirection: 'row', gap: espace[2] },
  repere: { width: 24, height: 8, borderRadius: rayon.s, borderWidth: bord.fin },
  actions: { flexDirection: 'row', alignItems: 'center', gap: espace[3], marginTop: espace[2] },
  flex: { flex: 1 },
});
