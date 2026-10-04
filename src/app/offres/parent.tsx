import { Redirect } from 'expo-router';

import { LienParent } from '@/components/pass/LienParent';
import { paiementPossible } from '@/services/plateforme';

export default function EcranLienParent() {
  if (!paiementPossible()) return <Redirect href="/" />;
  return <LienParent />;
}
