import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { lireAcces, type Acces } from '@/services/pass';
import { getSupabase } from '@/services/supabase';

/**
 * Accès pass de l'élève (RPC `my_access`), relu au montage et à chaque retour
 * dans l'app. Un parent peut payer sur le web pendant que l'app est en
 * arrière-plan : sans cette relecture, l'élève ne verrait son pass qu'en
 * rouvrant un écran.
 */
export function useAcces(utilisateur: string | null) {
  const [acces, setAcces] = useState<Acces>(null);

  // Montage et changement d'utilisateur.
  useEffect(() => {
    let vivant = true;
    const promesse = utilisateur ? lireAcces(getSupabase()).catch(() => null) : Promise.resolve(null);
    void promesse.then((a) => {
      if (vivant) setAcces(a);
    });
    return () => {
      vivant = false;
    };
  }, [utilisateur]);

  // Retour dans l'app : le pass a pu s'activer entre-temps (paiement parent sur le web).
  useEffect(() => {
    if (!utilisateur) return;
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat !== 'active') return;
      void lireAcces(getSupabase())
        .catch(() => null)
        .then((a) => setAcces(a));
    });
    return () => abonnement.remove();
  }, [utilisateur]);

  return { acces };
}
