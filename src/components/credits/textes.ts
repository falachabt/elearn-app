import { useCallback } from 'react';

import { useTraduction } from '@/i18n/useTraduction';
import { delaiJusqua, type ActionCredit } from '@/services/credits';

/** Textes communs des crédits : coût (« 1 crédit », « 5 crédits »), compte à rebours, libellé d'une action. */
export function useTextesCredits() {
  const { t } = useTraduction();
  const cout = useCallback((n: number) => (n === 1 ? t('credits.coutUn') : t('credits.cout', { n })), [t]);
  const delai = useCallback(
    (cible: string, maintenant = new Date()) => {
      const d = delaiJusqua(cible, maintenant);
      if (d.jours >= 3) return t('credits.delaiJoursSeuls', { j: d.jours });
      if (d.jours > 0) return t('credits.delaiJours', { j: d.jours, h: d.heures });
      return t('credits.delaiHeures', { h: d.heures, m: d.minutes });
    },
    [t],
  );
  const action = useCallback((a: ActionCredit) => t(`credits.actions.${a}`), [t]);
  return { t, cout, delai, action };
}
