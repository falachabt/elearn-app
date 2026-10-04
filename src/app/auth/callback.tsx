import { Redirect } from 'expo-router';

/**
 * Retour OAuth (`elearnprepa://auth/callback?...`). La session est installée par `connecterOAuth`, qui lit cette URL
 * depuis la fenêtre d'authentification ; si Android ouvre aussi le lien dans l'app, on revient simplement à l'accueil.
 */
export default function RetourAuth() {
  return <Redirect href="/moi" />;
}
