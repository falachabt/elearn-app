import { useState } from 'react';

import { useTraduction } from '@/i18n/useTraduction';
import { activerRappel, reporterRappel } from '@/services/rappels';

import { Banniere } from './Banniere';
import { Feuille } from './Feuille';

/** Explique le rappel quotidien avant de demander la permission des notifications au système (M9-01). */
export function FeuilleRappel({ ouverte, onFermer }: { ouverte: boolean; onFermer: () => void }) {
  const { t } = useTraduction();
  const [refuse, setRefuse] = useState(false);
  const accepter = async () => {
    const ok = await activerRappel({ titre: t('rappel.notifTitre'), corps: t('rappel.notifCorps'), canal: t('rappel.canal') }).catch(() => false);
    if (ok) onFermer();
    else setRefuse(true);
  };
  const plusTard = () => {
    if (!refuse) void reporterRappel();
    onFermer();
  };
  return (
    <Feuille
      ouverte={ouverte}
      onFermer={plusTard}
      icone="notifications-outline"
      titre={t('rappel.titre')}
      texte={t('rappel.texte')}
      actions={refuse ? [{ libelle: t('offres.fermer'), onPress: onFermer, variante: 'secondaire' }] : [
        { libelle: t('rappel.oui'), onPress: () => void accepter() },
        { libelle: t('rappel.pasMaintenant'), onPress: plusTard, variante: 'secondaire' },
      ]}
    >
      {refuse ? <Banniere ton="info" titre={t('rappel.refuse')} /> : null}
    </Feuille>
  );
}
