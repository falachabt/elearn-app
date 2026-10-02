import { Redirect } from 'expo-router';

import { Offres } from '@/components/pass/Offres';
import { paiementPossible } from '@/services/plateforme';

export default function EcranOffres() {
  // iOS : pas d'achat de pass (App Store) ; un ancien lien profond revient à l'accueil.
  if (!paiementPossible()) return <Redirect href="/" />;
  return <Offres />;
}
