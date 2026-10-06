import { router } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { libellePastille } from '@/services/notifications';
import { useNotifications } from '@/session/NotificationsProvider';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';

/**
 * N0 · Cloche de l'accueil (guide §25, K1) : pastille corail avec le nombre de non lues (« 9+ » au-delà), rien
 * quand tout est lu. Même gabarit que les pastilles voisines (série, éclair) : la ligne de l'accueil garde sa hauteur. Un appui ouvre le centre de notifications. Pas de cloche pour un invité (aucune notification
 * liée à un compte).
 */
export function Cloche() {
  const { t } = useTraduction();
  const { theme } = useTheme();
  const { session } = useSession();
  const { nonLues } = useNotifications();
  if (!session || session.user.is_anonymous) return null;

  const libelle = nonLues === 0 ? t('notifications.clocheAucune') : nonLues === 1 ? t('notifications.clocheUne') : t('notifications.clocheNon', { n: nonLues });
  return (
    <Appui accessibilityRole="button" accessibilityLabel={libelle} onPress={() => router.push('/notifications')} rayon={rayon.s} decalage={2} hitSlop={8} style={styles.zone}>
      <View style={styles.relatif}>
        <View style={[styles.cloche, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          <Bell size={14} strokeWidth={2.5} color={theme.texte.principal} />
        </View>
        {nonLues > 0 ? (
          <View testID="cloche-pastille" style={[styles.pastille, { backgroundColor: theme.etat.erreur, borderColor: theme.fond.surface }]}>
            <Text style={[typo.etiquette, styles.nombre, { color: theme.texte.surCouleur }]}>{libellePastille(nonLues)}</Text>
          </View>
        ) : null}
      </View>
    </Appui>
  );
}

const styles = StyleSheet.create({
  zone: { flexShrink: 0 },
  relatif: { position: 'relative' },
  // Mêmes marges et bordure que la pastille éclair (CompteurCredits) pour une hauteur identique.
  cloche: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: espace[3], paddingVertical: espace[2], borderWidth: bord.normal, borderRadius: rayon.s },
  // Petit badge à cheval sur le coin : il ne grandit pas la ligne.
  pastille: { position: 'absolute', top: -6, right: -6, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: rayon.pilule, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  nombre: { fontSize: 10, lineHeight: 12 },
});
