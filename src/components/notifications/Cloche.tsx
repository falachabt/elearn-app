import { router } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { libellePastille } from '@/services/notifications';
import { useNotifications } from '@/session/NotificationsProvider';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, cibleMin, rayon, typo } from '@/theme/theme';

import { Appui } from '../Appui';

/**
 * N0 · Cloche de l'accueil (guide §25, K1) : pastille corail avec le nombre de non lues (« 9+ » au-delà), rien
 * quand tout est lu. Un appui ouvre le centre de notifications. Pas de cloche pour un invité (aucune notification
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
    <Appui accessibilityRole="button" accessibilityLabel={libelle} onPress={() => router.push('/notifications')} rayon={rayon.s} decalage={2}>
      <View style={styles.zone}>
        <View style={[styles.cloche, { backgroundColor: theme.fond.surface, borderColor: theme.bord.fort }]}>
          <Bell size={18} strokeWidth={2} color={theme.texte.principal} />
        </View>
        {nonLues > 0 ? (
          <View testID="cloche-pastille" style={[styles.pastille, { backgroundColor: theme.etat.erreur, borderColor: theme.bord.fort }]}>
            <Text style={[typo.etiquette, styles.nombre, { color: theme.texte.surCouleur }]}>{libellePastille(nonLues)}</Text>
          </View>
        ) : null}
      </View>
    </Appui>
  );
}

const TAILLE = cibleMin - 8;

const styles = StyleSheet.create({
  zone: { width: cibleMin, height: cibleMin, alignItems: 'center', justifyContent: 'center' },
  cloche: { width: TAILLE, height: TAILLE, borderRadius: rayon.s, borderWidth: bord.normal, alignItems: 'center', justifyContent: 'center' },
  pastille: { position: 'absolute', top: 0, right: 0, minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: rayon.pilule, borderWidth: bord.fin, alignItems: 'center', justifyContent: 'center' },
  nombre: { fontSize: 11, lineHeight: 14 },
});
