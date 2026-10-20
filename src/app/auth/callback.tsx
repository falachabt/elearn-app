import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/services/supabase';
import { StyleSheet, Text, View } from 'react-native';

import { Logo } from '@/components/Logo';
import { Squelettes } from '@/components/liste/Squelettes';
import { useTraduction } from '@/i18n/useTraduction';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';

/**
 * Retour OAuth (`elearnprepa://auth/callback?...`). La session est installée par `connecterOAuth`, qui lit cette URL
 * depuis la fenêtre d'authentification ; si Android ouvre aussi le lien dans l'app, on revient simplement à l'accueil.
 * Pas de redirection tant que la session du compte n'est pas active : `/moi` ouvert plus tôt était renvoyé vers
 * « bienvenue » par la garde des onglets (session invité encore en place), le temps de l'installation de la session.
 * En attendant : le logo, une phrase, et des squelettes aux formes du contenu (jamais un écran blanc).
 */
export default function RetourAuth() {
  const { theme } = useTheme();
  const { t } = useTraduction();
  const { session } = useSession();
  const [abandon, setAbandon] = useState<'moi' | 'connexion' | null>(null);
  // Filet : si l'état de session tarde, on lit la vraie session stockée au lieu d'attendre indéfiniment.
  useEffect(() => {
    let actif = true;
    const minuteur = setTimeout(() => {
      getSupabase().auth.getSession()
        .then(({ data }) => actif && setAbandon(data.session && !data.session.user.is_anonymous ? 'moi' : 'connexion'))
        .catch(() => actif && setAbandon('connexion'));
    }, 6000);
    return () => {
      actif = false;
      clearTimeout(minuteur);
    };
  }, []);
  if (session && !session.user.is_anonymous) return <Redirect href="/moi" />;
  if (abandon === 'moi') return <Redirect href="/moi" />;
  if (abandon === 'connexion') return <Redirect href="/compte/connexion" />;
  return (
    <View style={[styles.racine, { backgroundColor: theme.fond.app }]}>
      <View style={styles.haut}>
        <Logo hauteur={48} />
        <Text style={[typo.texte, { color: theme.texte.secondaire }]}>{t('compte.retourEnCours')}</Text>
      </View>
      <Squelettes nombre={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, padding: espace[5], gap: espace[6], justifyContent: 'center' },
  haut: { alignItems: 'center', gap: espace[4] },
});
