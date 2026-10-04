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
  // `active` décrit si le contenu doit être demandé, pas l'identité du contenu.
  // Quand la réponse arrive, l'écran peut justement passer de l'énoncé à la
  // correction (ou marquer la question comme expliquée) : ce changement ne
  // doit pas invalider le résultat et relancer une ouverture.
  const cle = `${action}:${String(objet)}:${passActif ? 'pass' : 'credits'}`;
  const [resultat, setResultat] = useState<{ cle: string; etat: 'termine' | 'erreur' } | null>(null);
  const depenserRef = useRef(depenser);
  const onOuvertRef = useRef(onOuvert);

  // Les callbacks peuvent être recréés à chaque rendu par les écrans appelants.
  // On les synchronise dans un effet pour garder une seule requête par contenu,
  // sans lire ni modifier une ref pendant le rendu.
  useEffect(() => {
    depenserRef.current = depenser;
    onOuvertRef.current = onOuvert;
  }, [depenser, onOuvert]);

  useEffect(() => {
    if (!active || !passActif) {
      return;
    }

    let actif = true;
    void depenserRef.current<C>(action, objet)
      .then((r: Depense<C>) => {
        if (!actif) return;
        if (!r.contenu) {
          setResultat({ cle, etat: 'erreur' });
          return;
        }
        onOuvertRef.current(r.contenu, objet);
        setResultat({ cle, etat: 'termine' });
      })
      .catch(() => {
        if (actif) setResultat({ cle, etat: 'erreur' });
      });

    return () => {
      actif = false;
    };
  }, [action, active, objet, passActif, cle]);

  const etat = resultat?.cle === cle ? resultat.etat : null;
  return { passActif, enCours: active && passActif && etat === null, erreur: etat === 'erreur' };
}
