import { useCallback, useRef, useState } from 'react';

import { ContenuIndisponibleHorsLigne } from '@/services/creditsHorsLigne';
import { SEUIL_CONFIRMATION, type ActionCredit, type Depense } from '@/services/credits';
import { useTraduction } from '@/i18n/useTraduction';
import { useCredits } from '@/session/CreditsProvider';
import { useSession } from '@/session/SessionProvider';

import { Feuille } from '../Feuille';
import { FeuilleCout } from './FeuilleCout';
import { FeuilleEpuise } from './FeuilleEpuise';
import { useTextesCredits } from './textes';

type Options = { deja?: boolean };

/**
 * Parcours complet d'une action payante (M18-04, M18-07, M18-08) pour n'importe quel écran :
 * `const { lancer, feuilles } = useDepenseCredits();` puis `const r = await lancer('exercise_solution', id);`
 * et rendre `{feuilles}` à côté de l'écran. `lancer` demande l'accord à partir de 3 crédits (pas avec un pass ni pour
 * un contenu déjà ouvert), dépense et renvoie le résultat avec le contenu ; null si l'élève renonce, si le solde
 * manque (la feuille « Crédits épuisés » s'ouvre) ou si la limite IA du pass est atteinte.
 *
 * Hors ligne (issue #13) : si le contenu est déjà sur l'appareil, la dépense est débitée du dernier solde confirmé et
 * mise en file pour la reconnexion — `enAttente` est alors vrai, à signaler à l'écran. Sinon la feuille « Connexion
 * nécessaire » s'ouvre, car le serveur est seul à pouvoir fournir le contenu.
 */
export function useDepenseCredits({ rechargeSimple = false }: { rechargeSimple?: boolean } = {}) {
  const { solde, couts, depenser, depensesEnAttente } = useCredits();
  const { session } = useSession();
  const invite = !!session?.user.is_anonymous;
  const { t } = useTextesCredits();
  const { t: traduire } = useTraduction();
  const [confirmation, setConfirmation] = useState<{ action: ActionCredit; cout: number } | null>(null);
  const [epuise, setEpuise] = useState(false);
  const [limite, setLimite] = useState(false);
  const [connexionRequise, setConnexionRequise] = useState(false);
  const reponse = useRef<((oui: boolean) => void) | null>(null);

  const demanderAccord = (action: ActionCredit, cout: number) =>
    new Promise<boolean>((resoudre) => {
      reponse.current = resoudre;
      setConfirmation({ action, cout });
    });
  const repondre = (oui: boolean) => {
    setConfirmation(null);
    reponse.current?.(oui);
    reponse.current = null;
  };

  const lancer = useCallback(
    async <C = Record<string, unknown>,>(action: ActionCredit, objet: string | number, options: Options = {}): Promise<Depense<C> | null> => {
      const cout = couts[action] ?? 0;
      const sansAccord = options.deja || solde?.illimite || cout < SEUIL_CONFIRMATION;
      if (!sansAccord && !(await demanderAccord(action, cout))) return null;
      let r: Depense<C>;
      try {
        r = await depenser<C>(action, objet);
      } catch (erreur) {
        // Le contenu n'est pas sur l'appareil et le serveur est injoignable : seule une reconnexion peut le donner.
        if (erreur instanceof ContenuIndisponibleHorsLigne) {
          setConnexionRequise(true);
          return null;
        }
        throw erreur;
      }
      if (r.statut === 'insufficient') {
        setEpuise(true);
        return null;
      }
      if (r.statut === 'limit') {
        setLimite(true);
        return null;
      }
      return r;
    },
    [couts, solde, depenser],
  );

  const feuilles = (
    <>
      {confirmation ? (
        <FeuilleCout ouverte action={confirmation.action} cout={confirmation.cout} onValider={() => repondre(true)} onFermer={() => repondre(false)} />
      ) : null}
      <FeuilleEpuise ouverte={epuise} onFermer={() => setEpuise(false)} recharge={rechargeSimple && !invite} />
      <Feuille
        ouverte={limite}
        onFermer={() => setLimite(false)}
        titre={t('credits.limiteTitre')}
        texte={t('credits.limiteTexte')}
        actions={[{ libelle: t('credits.compris'), onPress: () => setLimite(false) }]}
      />
      <Feuille
        ouverte={connexionRequise}
        onFermer={() => setConnexionRequise(false)}
        icone="cloud-offline-outline"
        titre={traduire('reseau.necessite')}
        texte={traduire('reseau.necessiteTexte')}
        actions={[{ libelle: traduire('reseau.compris'), onPress: () => setConnexionRequise(false) }]}
      />
    </>
  );

  return { lancer, feuilles, enAttente: depensesEnAttente > 0 };
}
