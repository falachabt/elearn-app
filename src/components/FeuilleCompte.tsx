import { useCallback, useRef, useState, type ReactNode } from 'react';

import { useTraduction } from '@/i18n/useTraduction';
import { suivre } from '@/services/analytics';
import { useSession } from '@/session/SessionProvider';

import { OptionsCompte } from './arrivee/FeuilleSauvegarde';
import { Feuille } from './Feuille';

export type RaisonCompte = 'paiement' | 'parent' | 'rappel' | 'question';

type Props = {
  raison: RaisonCompte | null;
  onFermer: () => void;
  /** Appelé une fois le compte créé ou retrouvé. */
  onCompte: () => void;
};

/** Feuille « compte requis » : avant une action liée au compte (paiement, lien parent) ou pour rappeler à l'invité. */
export function FeuilleCompte({ raison, onFermer, onCompte }: Props) {
  const { t } = useTraduction();
  if (!raison) return null;
  const fermer = () => {
    suivre('account_prompt_dismissed', { raison });
    onFermer();
  };
  return (
    <Feuille ouverte onFermer={fermer} icone={raison === 'rappel' ? 'cloud-upload-outline' : 'person-add-outline'} titre={t(`compteRequis.${raison}Titre`)} texte={t(`compteRequis.${raison}Texte`)} actions={[]}>
      <OptionsCompte onPlusTard={fermer} onSauvegarde={onCompte} />
    </Feuille>
  );
}

/** Invité = session anonyme ; sans session (hors ligne), on considère aussi l'élève comme invité. */
export function useInvite(): boolean {
  const { session } = useSession();
  return session?.user.is_anonymous ?? true;
}

/**
 * `exiger(raison, suite)` lance `suite` tout de suite si l'élève a un compte, sinon ouvre la feuille et la lance
 * une fois le compte créé. `feuille` est à rendre à côté de l'écran.
 */
export function useCompteRequis(): { exiger: (raison: RaisonCompte, suite: () => void) => void; feuille: ReactNode } {
  const invite = useInvite();
  const [raison, setRaison] = useState<RaisonCompte | null>(null);
  const suite = useRef<(() => void) | null>(null);
  const exiger = useCallback(
    (r: RaisonCompte, apres: () => void) => {
      if (!invite) return apres();
      suite.current = apres;
      suivre('account_prompt_shown', { raison: r });
      setRaison(r);
    },
    [invite],
  );
  const feuille = (
    <FeuilleCompte
      raison={raison}
      onFermer={() => setRaison(null)}
      onCompte={() => {
        setRaison(null);
        suite.current?.();
        suite.current = null;
      }}
    />
  );
  return { exiger, feuille };
}
