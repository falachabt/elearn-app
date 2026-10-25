import { Redirect } from 'expo-router';

/**
 * Ancien écran de choix de la certification (orphelin) : son contenu vit désormais dans l'onglet
 * Certification de la page de changement (issue #125). La route redirige pour ne casser aucun lien existant.
 */
export default function EcranChoisirCertification() {
  return <Redirect href={{ pathname: '/profil/changer', params: { onglet: 'certification' } }} />;
}
