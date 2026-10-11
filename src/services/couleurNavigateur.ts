import { Platform } from 'react-native';

/**
 * Web : colore la barre du navigateur (balise `theme-color`) selon le thème de l'app. Le HTML porte deux balises liées au
 * thème du système ; dès que l'app connaît le thème choisi (Clair, Sombre ou Système), elles sont remplacées par une seule
 * balise sans condition, sinon un réglage manuel contredirait la couleur de la barre. Sans effet hors web.
 */
export function appliquerCouleurNavigateur(couleur: string, doc: Document | undefined = Platform.OS === 'web' ? globalThis.document : undefined): void {
  if (!doc?.head) return;
  const balises = Array.from(doc.head.querySelectorAll('meta[name="theme-color"]'));
  const [premiere, ...autres] = balises;
  autres.forEach((b) => b.remove());
  const balise = premiere ?? doc.createElement('meta');
  balise.setAttribute('name', 'theme-color');
  balise.removeAttribute('media');
  balise.setAttribute('content', couleur);
  if (!premiere) doc.head.appendChild(balise);
}
