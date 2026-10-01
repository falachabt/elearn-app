import { useCallback, useState } from 'react';

/**
 * Dernier état affiché de chaque écran de contenu (cours, chapitre, entraînement, annales…), gardé le temps de
 * l'application. En revenant sur un écran déjà vu, on montre tout de suite ce qu'il affichait, sans squelette, et le
 * rechargement le remplace discrètement quand il arrive.
 */
const etats = new Map<string, unknown>();

export function oublierEtatsMemorises() {
  etats.clear();
}

type AvecStatut = { statut: string };
const ATTENTE = new Set(['chargement', 'erreur']);

/**
 * `useState` pour l'état d'un écran de contenu, retrouvé au retour sur l'écran. Seuls les états affichables sont
 * gardés ; une erreur de rechargement ne remplace pas des données déjà à l'écran.
 */
export function useEtatMemorise<E extends AvecStatut>(cle: string, initial: E): [E, (e: E) => void] {
  const [courant, setCourant] = useState<{ cle: string; etat: E }>(() => ({ cle, etat: (etats.get(cle) as E | undefined) ?? initial }));
  let etat = courant.etat;
  if (courant.cle !== cle) {
    // Même écran, autre contenu (paramètre de route changé) : on repart de ce qu'on sait de ce contenu-là.
    etat = (etats.get(cle) as E | undefined) ?? initial;
    setCourant({ cle, etat });
  }
  const definir = useCallback(
    (e: E) => {
      if (!ATTENTE.has(e.statut)) etats.set(cle, e);
      else if (e.statut === 'erreur' && etats.has(cle)) return;
      setCourant({ cle, etat: e });
    },
    [cle],
  );
  return [etat, definir];
}
