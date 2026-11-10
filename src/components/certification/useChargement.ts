import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

export type Chargement<T> = { phase: 'chargement' } | { phase: 'erreur' } | { phase: 'ok'; valeur: T };

/**
 * Charge des données à chaque fois que l'écran reprend le focus (retour d'une série, d'une séance de mots) : les
 * chiffres affichés ne restent jamais ceux d'avant. `recharger` repasse par le squelette (bouton « Réessayer »).
 */
export function useChargement<T>(lire: () => Promise<T>): { etat: Chargement<T>; recharger: () => void } {
  const [etat, setEtat] = useState<Chargement<T>>({ phase: 'chargement' });
  const [tour, setTour] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let actif = true;
      void tour;
      lire()
        .then((valeur) => actif && setEtat({ phase: 'ok', valeur }))
        .catch(() => actif && setEtat((avant) => (avant.phase === 'ok' ? avant : { phase: 'erreur' })));
      return () => {
        actif = false;
      };
    }, [lire, tour]),
  );
  const recharger = useCallback(() => {
    setEtat({ phase: 'chargement' });
    setTour((n) => n + 1);
  }, []);
  return { etat, recharger };
}
