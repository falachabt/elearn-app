import { Linking } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { lienSupport } from '@/services/ancienCompte';

import { Bouton } from '../Bouton';

/**
 * Lien d'aide discret vers le support WhatsApp (message prérempli). Un simple bouton texte, posé près d'un paiement :
 * il ne gêne pas le parcours, mais l'élève sait où écrire si le paiement pose problème.
 */
export function LienSupport({ reference }: { reference?: string }) {
  const { t } = useTraduction();
  const message = t('support.messagePaiement', { reference: reference?.trim() || '…' });
  return (
    <Bouton
      petit
      variante="texte"
      libelle={t('support.aidePaiement')}
      onPress={() => {
        Linking.openURL(lienSupport(message)).catch(() => {});
      }}
    />
  );
}
