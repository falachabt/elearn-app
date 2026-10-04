import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { conserverCode } from '@/services/parrainage';

/** Lien `elearnprepa://rejoindre/<code>` : on garde le code 7 jours (rattachement au parrain) puis on ouvre l'app normalement. */
export default function Rejoindre() {
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
