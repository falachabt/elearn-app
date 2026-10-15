import { useEffect, useState } from 'react';

import { ecouterDrapeaux } from '@/services/analytics';
import { profilCertificationOuvert } from '@/services/certification/drapeau';

/** Vrai quand le drapeau `cert_profile_enabled` est actif ; se met à jour au rechargement des drapeaux. */
export function useProfilCertification(): boolean {
  const [ouvert, setOuvert] = useState(profilCertificationOuvert);
  useEffect(() => {
    setOuvert(profilCertificationOuvert());
    return ecouterDrapeaux(() => setOuvert(profilCertificationOuvert()));
  }, []);
  return ouvert;
}
