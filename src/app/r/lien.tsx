import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Routeur d'appoint des liens universels.
 *
 * Dans les builds **3.1.0**, seuls `/r/*` et `/rejoindre/*` sont déclarés comme liens universels (voir `app.json` et
 * l'`apple-app-site-association`). Tout autre chemin — `/offres/retour` après un paiement Chariow, par exemple —
 * ouvre le navigateur au lieu de l'application, parce que le système ne sait pas à qui il appartient.
 *
 * D'où ce détour : `https://app.elearnprepa.com/r/lien?vers=%2Foffres%2Fretour%3Fcommande%3D…` ouvre l'application
 * (le préfixe `/r` est déjà déclaré) puis la fait naviguer vers l'écran demandé. **Aucun nouveau binaire n'est
 * nécessaire** : ajouter ou retirer une destination ci-dessous ne demande qu'une mise à jour OTA.
 *
 * Quand les chemins directs seront déclarés dans un prochain build, ce routeur restera utile pour les appareils qui
 * n'auront pas encore la mise à jour.
 *
 * Sécurité : seuls des chemins **internes** figurant dans cette liste sont acceptés. Un lien universel est public :
 * il ne doit pas pouvoir faire naviguer l'application n'importe où.
 */
export const DESTINATIONS = [
  '/offres',
  '/pass',
  '/compte',
  '/credits',
  '/discussion',
  '/ma-semaine',
  '/moi',
  '/parrainage',
  '/reviser',
];

/** La cible est-elle un chemin interne connu ? (exporté pour être testé sans monter l'écran) */
export function cibleAutorisee(vers: unknown): string | null {
  if (typeof vers !== 'string' || !vers.startsWith('/') || vers.startsWith('//')) return null;
  const chemin = vers.split(/[?#]/)[0];
  return DESTINATIONS.some((d) => chemin === d || chemin.startsWith(`${d}/`)) ? vers : null;
}

export default function RouteurLien() {
  const { vers } = useLocalSearchParams<{ vers?: string }>();
  // Cible refusée ou absente : on ramène simplement à l'accueil plutôt que d'afficher une erreur.
  return <Redirect href={(cibleAutorisee(vers) ?? '/') as never} />;
}
