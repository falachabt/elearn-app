import { useTranslation } from 'react-i18next';

import { changerLangue, langueSupportee, LANGUE_PAR_DEFAUT, type CleTexte, type Langue } from './index';

/** Hook de traduction : `const { t } = useT(); t('accueil.titre')`. Les clés sont typées et l'écran se met à jour au changement de langue. */
export function useTraduction() {
  const { t, i18n } = useTranslation();
  const langue: Langue = langueSupportee(i18n.resolvedLanguage ?? i18n.language) ?? LANGUE_PAR_DEFAUT;
  return {
    t: (cle: CleTexte, options?: Record<string, unknown>): string => t(cle, options) as string,
    langue,
    changerLangue,
  };
}

export const useT = useTraduction;
