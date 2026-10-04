import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { conserverCode } from '@/services/parrainage';

/** Lien `elearnprepa://r/<code>` : enregistre le code de parrainage pendant 7 jours puis redirige vers l'accueil. */
export default function ParrainageDeepLink() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [fini, setFini] = useState(false);

  useEffect(() => {
    let actif = true;
    (code ? conserverCode(String(code), 'lien') : Promise.resolve(null)).finally(() => actif && setFini(true));
    return () => {
      actif = false;
    };
  }, [code]);

  return fini ? <Redirect href="/" /> : null;
}
