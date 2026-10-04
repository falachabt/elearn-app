import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { conserverCode } from '@/services/parrainage';

/** Lien `elearnprepa://r/<code>` : enregistre le code de parrainage pendant 7 jours puis redirige vers la création de compte. */
export default function ParrainageDeepLink() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [fini, setFini] = useState(false);

  useEffect(() => {
    let actif = true;
    if (code) {
      void conserverCode(String(code), 'lien')
        .then((codeValide) => {
          if (actif && codeValide) {
            Alert.alert(
              '🎁 Code parrain activé !',
              `Le code ${codeValide} a été pris en compte. Crée ton compte pour bénéficier de tes crédits offerts et de -15% sur ton premier Pass !`
            );
          }
        })
        .finally(() => actif && setFini(true));
    } else {
      setFini(true);
    }
    return () => {
      actif = false;
    };
  }, [code]);

  return fini ? <Redirect href="/compte/creer" /> : null;
}
