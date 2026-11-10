import { Redirect } from 'expo-router';

import { Paiements } from '@/components/moi/Paiements';
import { paiementPossible } from '@/services/plateforme';

/** Historique des paiements Mobile Money : Android et web seulement, comme les autres routes de paiement (règle App Store 3.1.1). */
export default function EcranPaiements() {
  if (!paiementPossible()) return <Redirect href="/" />;
  return <Paiements />;
}
