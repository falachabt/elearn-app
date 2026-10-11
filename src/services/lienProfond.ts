import * as Linking from 'expo-linking';

import { capturerDepuisUrl, extraireCodeDepuisUrl } from './parrainage';

/**
 * Capte `?ref=<code>` sur n'importe quel lien d'ouverture (à froid ou app déjà lancée). Les liens `…/rejoindre/<code>`
 * sont traités par la route `rejoindre/[code]`, pas ici (un seul événement `referral_code_captured`).
 * Renvoie la fonction qui arrête l'écoute.
 */
export function ecouterLiensParrainage(): () => void {
  const traiter = (url: string | null) => {
    if (url && !/\/(?:r|rejoindre)\//i.test(url) && extraireCodeDepuisUrl(url)) void capturerDepuisUrl(url);
  };
  Linking.getInitialURL().then(traiter).catch(() => {});
  const abo = Linking.addEventListener('url', (e) => traiter(e.url));
  return () => abo.remove();
}
