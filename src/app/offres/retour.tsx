import { Redirect, useLocalSearchParams } from 'expo-router';

import { RetourPaiement } from '@/components/pass/RetourPaiement';
import { paiementPossible } from '@/services/plateforme';

/**
 * Retour de paiement Chariow. Chariow redirige ici après le paiement : la page web, ou le lien universel qui rouvre
 * l'application. Le résultat vient toujours du serveur (la commande), jamais de l'adresse.
 */
export default function EcranRetourPaiement() {
  const { commande } = useLocalSearchParams<{ commande?: string }>();
  if (!paiementPossible()) return <Redirect href="/" />;
  return <RetourPaiement commande={typeof commande === 'string' && commande ? commande : null} />;
}
