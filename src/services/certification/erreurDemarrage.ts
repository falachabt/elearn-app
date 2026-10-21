import { suivre } from '@/services/analytics';

/** Étape du démarrage où l'erreur est née : lecture du profil, appel serveur, écriture sur l'appareil. */
export type EtapeDemarrage = 'profil' | 'appel' | 'stockage';

const LONGUEUR_MOTIF = 80;

/** Erreur de démarrage qui garde l'étape d'origine (le message seul ne dit pas où l'appel a échoué). */
export class ErreurDemarrage extends Error {
  constructor(
    readonly etape: EtapeDemarrage,
    readonly origine: unknown,
  ) {
    super(motifDe(origine));
  }
}

/** Message court et sans donnée personnelle : le texte de l'erreur, coupé. */
export function motifDe(erreur: unknown): string {
  const texte = erreur instanceof Error ? erreur.message : typeof erreur === 'string' ? erreur : '';
  return (texte || (erreur instanceof Error ? erreur.name : 'inconnue')).slice(0, LONGUEUR_MOTIF);
}

/** Exécute une étape du démarrage et marque l'erreur de cette étape. */
export async function etapeDemarrage<T>(etape: EtapeDemarrage, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (erreur) {
    throw erreur instanceof ErreurDemarrage ? erreur : new ErreurDemarrage(etape, erreur);
  }
}

/** Empreinte stable de l'étape et du motif : même échec, même code, donc Benny peut le donner et PostHog le retrouve. */
function empreinte(texte: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i += 1) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).toUpperCase().padStart(4, '0').slice(-4);
}

/**
 * Signale l'échec du démarrage (évènement PostHog, sans donnée personnelle) et renvoie le code court affiché à l'élève.
 * `prefixe` identifie l'épreuve : MIN pour le mini-test, DIA pour le diagnostic.
 */
export function signalerErreurDemarrage(ecran: string, prefixe: string, erreur: unknown): string {
  const etape: EtapeDemarrage | 'inconnue' = erreur instanceof ErreurDemarrage ? erreur.etape : 'inconnue';
  const motif = motifDe(erreur instanceof ErreurDemarrage ? erreur.origine : erreur);
  const code = `${prefixe}-${empreinte(`${etape}|${motif}`)}`;
  suivre('cert_start_error', { ecran, etape, motif, code });
  return code;
}
