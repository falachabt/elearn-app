import { drapeauActif } from '../analytics';

export const DRAPEAU_PROFIL_CERT = 'cert_profile_enabled';

/**
 * Le profil certification est-il ouvert ? Derrière le drapeau PostHog `cert_profile_enabled` (R-09). Un essai local peut
 * le forcer (`EXPO_PUBLIC_CERT_PROFILE=1`, ou le mode démo en développement) ; jamais en production sans le drapeau.
 */
export function profilCertificationOuvert(): boolean {
  const force = __DEV__ && (process.env.EXPO_PUBLIC_CERT_PROFILE === '1' || process.env.EXPO_PUBLIC_CERT_DEMO === '1');
  return drapeauActif(DRAPEAU_PROFIL_CERT, force);
}
