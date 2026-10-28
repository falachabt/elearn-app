import { Redirect } from 'expo-router';

import { DetailPaiement } from '@/components/moi/Paiements';
import { paiementPossible } from '@/services/plateforme';

/** Détail d'un paiement Mobile Money : Android et web seulement, comme les autres routes de paiement (règle App Store 3.1.1). */
export default function EcranDetailPaiement() {
  if (!paiementPossible()) return <Redirect href="/" />;
  return <DetailPaiement />;
}
