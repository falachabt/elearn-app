import { useCallback, useMemo, useState } from 'react';

import { estErreurReseau, signalerEchec, signalerSucces } from '@/services/connectivite';
import { useTraduction } from '@/i18n/useTraduction';

import { Banniere } from '../Banniere';
import { useReseau } from './useReseau';

/**
 * Garde réseau d'une action qui exige une réponse du serveur (issue #25).
 *
 * Usage dans un écran :
 *
 * ```tsx
 * const { garde, horsLigne, banniere } = useGardeReseau();
 * const envoyer = () => garde(() => depenser('ai_question', id));
 * // ... dans le rendu :
 * {banniere}
 * ```
 *
 * `garde` exécute l'action en ligne et renvoie sa valeur ; hors ligne elle ne lance rien, affiche
 * « Connexion nécessaire » et renvoie null. L'élève n'a donc jamais d'échec silencieux, et rien n'est présenté
 * comme réussi alors que rien n'est parti au serveur.
 *
 * Deux détails qui comptent :
 * - un échec **réseau** de l'action marque l'app hors ligne immédiatement (`signalerEchec`), sans attendre la
 *   prochaine sonde ; l'erreur est ensuite relayée à l'appelant, qui garde son propre message ;
 * - un succès annule un échec de sonde périmé (`signalerSucces`), puisque le serveur vient de répondre.
 *
 * Le message disparaît de lui-même au retour du réseau. Pour cela, `bloque` n'est pas un état synchronisé par un
 * effet — ce que React déconseille (`react-hooks/set-state-in-effect`) — mais une valeur **dérivée** : on retient
 * l'état de connexion au moment du blocage, et le blocage ne vaut que tant que cet état n'a pas changé.
 */
export function useGardeReseau() {
  const { estEnLigne } = useReseau();
  const { t } = useTraduction();
  /** Valeurs de `estEnLigne` pour lesquelles une action a été bloquée. */
  const [blocages, setBlocages] = useState<readonly boolean[]>([]);

  const bloquer = useCallback((connexion: boolean) => {
    setBlocages((precedents) => [...precedents, connexion]);
  }, []);

  // Dérivé : un blocage ne tient que pour l'état de connexion qui l'a provoqué. Le réseau revient -> estEnLigne
  // change -> plus aucun blocage ne correspond -> le message disparaît, sans effet ni setState.
  const bloque = useMemo(() => blocages.some((valeur) => valeur === estEnLigne), [blocages, estEnLigne]);

  const garde = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | null> => {
      if (!estEnLigne) {
        bloquer(false);
        return null;
      }
      try {
        const resultat = await action();
        signalerSucces();
        return resultat;
      } catch (erreur) {
        if (estErreurReseau(erreur)) signalerEchec();
        throw erreur;
      }
    },
    [estEnLigne, bloquer],
  );

  /** Signale le blocage sans exécuter d'action : pour les cas où la garde ne peut pas enrober l'appel. */
  const bloquerReseau = useCallback(() => bloquer(false), [bloquer]);

  const banniere = bloque ? <Banniere ton="alerte" titre={t('reseau.necessite')} texte={t('reseau.necessiteTexte')} /> : null;

  return { garde, horsLigne: !estEnLigne, bloque, bloquerReseau, banniere };
}
