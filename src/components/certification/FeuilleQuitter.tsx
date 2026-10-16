import { useTraduction } from '@/i18n/useTraduction';

import { Feuille } from '../Feuille';

/** X3 · Quitter une série : les réponses restent sur l'appareil, la reprise se fait au même endroit. */
export function FeuilleQuitter({ ouverte, onReprendre, onQuitter, mots }: { ouverte: boolean; onReprendre: () => void; onQuitter: () => void; mots?: boolean }) {
  const { t } = useTraduction();
  return (
    <Feuille
      ouverte={ouverte}
      onFermer={onReprendre}
      titre={mots ? t('certification.seanceMots.quitterTitre') : t('certification.quitter.titre')}
      texte={mots ? t('certification.seanceMots.quitterTexte') : `${t('certification.quitter.sousTitre')}\n${t('certification.quitter.texte')}`}
      actions={[
        { libelle: mots ? t('certification.seanceMots.quitterReprendre') : t('certification.quitter.reprendre'), onPress: onReprendre },
        { libelle: mots ? t('certification.seanceMots.quitterQuitter') : t('certification.quitter.quitter'), onPress: onQuitter, variante: 'texte' },
      ]}
    />
  );
}
