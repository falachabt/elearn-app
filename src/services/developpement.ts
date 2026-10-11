import { lireVersion } from './version';

/**
 * Le build autorise-t-il les outils de développement ? Vrai en développement, sur le canal EAS « preview », ou quand
 * l'aperçu est demandé (`EXPO_PUBLIC_APERCU=1`).
 *
 * Ce test était dupliqué à plusieurs endroits (suppression immédiate de compte, écran de mise à jour). Il est
 * centralisé ici pour qu'un nouvel outil ne puisse pas l'oublier : ces fonctions ne doivent **jamais** être actives
 * sur un build de production.
 */
export function modeDeveloppement(): boolean {
  if (__DEV__) return true;
  if (process.env.EXPO_PUBLIC_APERCU === '1') return true;
  try {
    return lireVersion().canal === 'preview';
  } catch {
    return false;
  }
}
