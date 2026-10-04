import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { conserverCode } from '@/services/parrainage';
import { getSupabase } from '@/services/supabase';

/** Lien `elearnprepa://r/<code>` : enregistre le code de parrainage pendant 7 jours puis redirige vers la création de compte ou l'accueil. */
export default function ParrainageDeepLink() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [fini, setFini] = useState(false);
  const [estInvite, setEstInvite] = useState(true);

  useEffect(() => {
    let actif = true;
    (async () => {
      try {
        const client = getSupabase();
        const { data } = await client.auth.getSession();
        const invite = !data.session?.user || data.session.user.is_anonymous === true;
        if (actif) setEstInvite(invite);

        if (code) {
          const codeValide = await conserverCode(String(code), 'lien');
          if (actif && codeValide) {
            if (invite) {
              Alert.alert(
                '🎁 Code parrain activé !',
                `Le code ${codeValide} a été pris en compte. Crée ton compte pour bénéficier de tes crédits offerts et de -15% sur ton premier Pass !`
              );
            } else {
              Alert.alert(
                'Information parrainage',
                `Tu es déjà connecté(e) avec un compte permanent (${data.session?.user.email ?? ''}). Les codes de parrainage s'appliquent lors de la création d'un nouveau compte.`
              );
            }
          }
        }
      } catch {
        // En cas d'erreur réseau, on ne bloque pas
      } finally {
        if (actif) setFini(true);
      }
    })();

    return () => {
      actif = false;
    };
  }, [code]);

  if (!fini) return null;
  return estInvite ? <Redirect href="/compte/creer" /> : <Redirect href="/" />;
}
