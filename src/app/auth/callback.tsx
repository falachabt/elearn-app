import { Redirect, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Logo } from '@/components/Logo';
import { Squelettes } from '@/components/liste/Squelettes';
import { useTraduction } from '@/i18n/useTraduction';
import { useSession } from '@/session/SessionProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { espace, typo } from '@/theme/theme';
import { echangerCodeOAuthUneFois, lireRetourOAuth } from '@/services/compte';
import { getSupabase } from '@/services/supabase';

/**
 * Retour OAuth (`elearnprepa://auth/callback?...`).
 * Gère l'échange du code PKCE ou des jetons reçus dans l'URL de redirection sur Android/iOS/Web.
 */
export default function RetourAuth() {
  const { theme } = useTheme();
  const { t } = useTraduction();
  const { session } = useSession();
  const params = useLocalSearchParams<{ code?: string; error?: string; error_code?: string; error_description?: string; access_token?: string; refresh_token?: string }>();
  const [destination, setDestination] = useState<'/moi' | '/compte/connexion' | null>(null);

  useEffect(() => {
    let actif = true;

    async function finaliser() {
      const client = getSupabase();

      // 1. Si déjà connecté avec un vrai compte : direct /moi
      const { data: courante } = await client.auth.getSession().catch(() => ({ data: { session: null } }));
      if (courante.session && !courante.session.user.is_anonymous) {
        if (actif) setDestination('/moi');
        return;
      }

      // 2. Extraire code ou tokens depuis params ou Linking
      let code = params.code;
      let accessToken = params.access_token;
      let refreshToken = params.refresh_token;
      let erreur = params.error;

      if (!code && !accessToken && !erreur) {
        const urlInit = await Linking.getInitialURL().catch(() => null);
        if (urlInit) {
          const r = lireRetourOAuth(urlInit);
          code = r.code ?? undefined;
          accessToken = r.accessToken ?? undefined;
          refreshToken = r.refreshToken ?? undefined;
          erreur = r.erreur ?? undefined;
        }
      }

      if (erreur) {
        if (actif) setDestination('/compte/connexion');
        return;
      }

      if (code) {
        const { error: err } = await echangerCodeOAuthUneFois(client, code);
        if (actif) {
          if (!err) {
            setDestination('/moi');
          } else {
            const { data: apres } = await client.auth.getSession().catch(() => ({ data: { session: null } }));
            setDestination(apres.session && !apres.session.user.is_anonymous ? '/moi' : '/compte/connexion');
          }
        }
        return;
      }

      if (accessToken && refreshToken) {
        const { error: err } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (actif) {
          setDestination(!err ? '/moi' : '/compte/connexion');
        }
        return;
      }

      // Filet : si l'URL ne portait aucun paramètre (navigateur tiers ou ouverture directe)
      const minuteur = setTimeout(async () => {
        if (!actif) return;
        const { data: s } = await client.auth.getSession().catch(() => ({ data: { session: null } }));
        if (actif) setDestination(s.session && !s.session.user.is_anonymous ? '/moi' : '/compte/connexion');
      }, 3000);

      return () => clearTimeout(minuteur);
    }

    void finaliser();

    return () => {
      actif = false;
    };
  }, [params.access_token, params.code, params.error, params.refresh_token]);

  if (session && !session.user.is_anonymous) return <Redirect href="/moi" />;
  if (destination) return <Redirect href={destination} />;

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
