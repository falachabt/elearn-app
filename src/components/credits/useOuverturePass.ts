import { useEffect, useRef, useState } from 'react';

import type { ActionCredit, Depense } from '@/services/credits';
import { useCredits } from '@/session/CreditsProvider';

type Props<C> = {
  action: ActionCredit;
  objet: string | number;
  /** Le contenu est demandé automatiquement seulement quand cette condition est vraie. */
  active: boolean;
  onOuvert: (contenu: C, objet: string | number) => void;
};

/**
 * Ouvre un contenu directement pour un élève qui a un pass actif.
 * Le serveur reste la source de vérité : `depenser_credits` renvoie le contenu
 * avec le statut `unlimited`, sans débiter de crédit.
 */
export function useOuverturePass<C = Record<string, unknown>>({ action, objet, active, onOuvert }: Props<C>) {
  const { solde, depenser } = useCredits();
  const passActif = !!solde?.illimite;
  const [etat, setEtat] = useState<'inactif' | 'chargement' | 'erreur'>('inactif');
  const depenserRef = useRef(depenser);
  const onOuvertRef = useRef(onOuvert);
  depenserRef.current = depenser;
  onOuvertRef.current = onOuvert;

  useEffect(() => {
    if (!active || !passActif) {
      setEtat('inactif');
      return;
    }

    let actif = true;
    setEtat('chargement');
    void depenserRef.current<C>(action, objet)
      .then((r: Depense<C>) => {
        if (!actif) return;
        if (!r.contenu) {
          setEtat('erreur');
          return;
        }
        onOuvertRef.current(r.contenu, objet);
        setEtat('inactif');
      })
      .catch(() => {
        if (actif) setEtat('erreur');
      });

    return () => {
      actif = false;
    };
  }, [action, active, objet, passActif]);

  return { passActif, enCours: etat === 'chargement', erreur: etat === 'erreur' };
}
