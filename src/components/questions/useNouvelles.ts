import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { abonnerNouvelles, actualiserNouvelles, lireNouvelles } from '@/services/questions';
import { lireProfil } from '@/services/profil';
import { getSupabase } from '@/services/supabase';
import { useSessionPrete } from '@/session/SessionProvider';

const INTERVALLE_MS = 120_000;

/** Nombre de questions nouvelles depuis la dernière ouverture de l'onglet (pastille de la barre). Rafraîchi au retour dans l'app et toutes les 2 min. */
export function useNouvellesQuestions(): number {
  const pret = useSessionPrete();
  const n = useSyncExternalStore(abonnerNouvelles, lireNouvelles, lireNouvelles);
  useEffect(() => {
    if (!pret) return;
    const rafraichir = () => void lireProfil().then((p) => actualiserNouvelles(getSupabase(), p?.niveau ?? null));
    rafraichir();
    const minuteur = setInterval(rafraichir, INTERVALLE_MS);
    const abonnement = AppState.addEventListener('change', (e) => e === 'active' && rafraichir());
    return () => {
      clearInterval(minuteur);
      abonnement.remove();
    };
  }, [pret]);
  return n;
}
