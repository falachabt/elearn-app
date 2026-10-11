import { useSyncExternalStore } from 'react';

import { ecouterConnectivite, estEnLigne, lireConnectivite, type EtatConnectivite } from '@/services/connectivite';

/**
 * État de connexion pour l'interface (issue #25). Se redessine à chaque changement d'état réseau.
 *
 * `estEnLigne` est faux dès qu'une sonde a montré que le serveur ne répond pas, même si l'interface réseau est
 * active : l'indicateur ne doit jamais annoncer « en ligne » quand le backend est injoignable.
 */
export function useReseau(): EtatConnectivite & { estEnLigne: boolean } {
  const etat = useSyncExternalStore(ecouterConnectivite, lireConnectivite, lireConnectivite);
  return { ...etat, estEnLigne: estEnLigne() };
}
