import { Redirect } from 'expo-router';

import { PayerPass } from '@/components/pass/PayerPass';
import { paiementPossible } from '@/services/plateforme';

export default function EcranPayerPass() {
  if (!paiementPossible()) return <Redirect href="/" />;
  return <PayerPass />;
}
