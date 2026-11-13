import { Check } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

/**
 * Étapes du traitement en cours, affichées dans le fil du labo pendant l'attente du moteur : même langage
 * visuel que l'écran d'analyse de la correction par photo (coche verte quand c'est fait, indicateur sur
 * l'étape en cours, étapes suivantes en attente). Les étapes reçues viennent du flux de la fonction
 * « conversation » (« envoi » est local : il couvre l'envoi des photos, avant la première réponse du serveur).
 */

export type EtapeChargement = 'envoi' | 'lecture' | 'analyse' | 'reflexion' | 'redaction' | 'visuel';

const ORDRE: Record<'photo' | 'texte', EtapeChargement[]> = {
  photo: ['envoi', 'lecture', 'analyse', 'redaction'],
  texte: ['reflexion', 'redaction', 'visuel'],
};

export function ChargementEtapes({ mode, recues, termine }: { mode: 'photo' | 'texte'; recues: readonly EtapeChargement[]; termine?: boolean }) {
  const { theme } = useTheme();
  const { t } = useTraduction();

  const libelles: Record<EtapeChargement, string> = {
    envoi: t('labo.etapeEnvoi'),
    lecture: t('labo.etapeLecture'),
    analyse: t('labo.etapeAnalyse'),
    reflexion: t('labo.etapeReflexion'),
    redaction: t(mode === 'photo' ? 'labo.etapeRedactionEtapes' : 'labo.etapeRedactionExplication'),
    visuel: t('labo.etapeVisuel'),
  };

  // « visuel » n'existe que si la réponse contient un bloc interactif : il n'apparaît dans la liste qu'une fois reçu.
  const affichees = ORDRE[mode].filter((e) => e !== 'visuel' || recues.includes('visuel'));

  return (
    <View accessibilityLiveRegion="polite" style={[styles.carte, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
      {affichees.map((e) => {
        const rang = recues.indexOf(e);
        const fait = rang >= 0 && (termine || rang < recues.length - 1);
        const enCours = rang >= 0 && !fait;
        return (
          <View key={e} accessibilityLabel={libelles[e]} style={styles.ligne}>
            <View style={[styles.coche, { borderColor: theme.bord.fort, backgroundColor: fait ? theme.etat.succes : 'transparent' }]}>
              {enCours ? (
                <ActivityIndicator size="small" color={theme.marque.principale} />
              ) : fait ? (
                <Check size={14} strokeWidth={3} color={theme.texte.surCouleur} />
              ) : null}
            </View>
            <Text style={[typo.texteFort, { color: theme.texte.principal, opacity: fait || enCours ? 1 : 0.55 }]}>{libelles[e]}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { borderWidth: bord.normal, borderRadius: rayon.l, padding: espace[4], gap: espace[3] },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: espace[3] },
  coche: { width: 28, height: 28, borderRadius: rayon.s, borderWidth: bord.fin, alignItems: 'center', justifyContent: 'center' },
});
