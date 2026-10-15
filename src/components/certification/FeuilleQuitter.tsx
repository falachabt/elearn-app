import { useTraduction } from '@/i18n/useTraduction';

import { Feuille } from '../Feuille';

/** X3 · Quitter une série : les réponses restent sur l'appareil, la reprise se fait au même endroit. */
export function FeuilleQuitter({ ouverte, onReprendre, onQuitter }: { ouverte: boolean; onReprendre: () => void; onQuitter: () => void }) {
  const { t } = useTraduction();
  return (
    <Feuille
      ouverte={ouverte}
      onFermer={onReprendre}
      titre={t('certification.quitter.titre')}
      texte={`${t('certification.quitter.sousTitre')}\n${t('certification.quitter.texte')}`}
      actions={[
        { libelle: t('certification.quitter.reprendre'), onPress: onReprendre },
        { libelle: t('certification.quitter.quitter'), onPress: onQuitter, variante: 'texte' },
      ]}
    />
  );
}
