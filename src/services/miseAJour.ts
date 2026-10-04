import * as Updates from 'expo-updates';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

export type EtatMiseAJour = 'aucune' | 'disponible' | 'telechargement' | 'prete' | 'erreur';

export type InfosMiseAJour = {
  etat: EtatMiseAJour;
  /** Mise à jour obligatoire : pas de « Plus tard », écran plein écran. */
  obligatoire: boolean;
  /** Message d'erreur technique (journal), jamais affiché tel quel à l'élève. */
  erreur: string | null;
};

export type ResultatVerification = { isAvailable: boolean; manifest?: unknown };

const PREFIXE_OBLIGATOIRE = /^\s*\[obligatoire\]/i;

function enObjet(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined;
}

/**
 * Convention « mise à jour obligatoire » (voir README) : le manifeste de l'update porte `obligatoire: true`
 * dans `extra` (`extra.obligatoire` ou `extra.expoClient.extra.obligatoire`, c'est-à-dire `expo.extra.obligatoire`
 * de app.json au moment du `eas update`), ou son message commence par `[obligatoire]`
 * (`metadata.message` / `extra.message`, quand le serveur le fournit).
 */
export function estObligatoire(manifest: unknown): boolean {
  const m = enObjet(manifest);
  if (!m) return false;
  const extra = enObjet(m.extra);
  const extraApp = enObjet(enObjet(extra?.expoClient)?.extra);
  const drapeau = extra?.obligatoire ?? extraApp?.obligatoire;
  if (drapeau === true || drapeau === 'true' || drapeau === 1) return true;
  const message = enObjet(m.metadata)?.message ?? extra?.message ?? extraApp?.message;
  return typeof message === 'string' && PREFIXE_OBLIGATOIRE.test(message);
}

/** Mises à jour OTA possibles : pas en développement, pas sur le web, et seulement si expo-updates est actif. */
export function miseAJourActivee(): boolean {
  return !__DEV__ && Platform.OS !== 'web' && Updates.isEnabled;
}

const INITIAL: InfosMiseAJour = { etat: 'aucune', obligatoire: false, erreur: null };

/**
 * Vérifie au démarrage et au retour au premier plan s'il existe une mise à jour OTA.
 * États : aucune → disponible → telechargement → prete (puis redémarrage) ; erreur si le téléchargement échoue.
 * `plusTard()` masque la proposition jusqu'à la prochaine ouverture de l'app (jamais pour une mise à jour obligatoire).
 * Une erreur de simple vérification (réseau) reste silencieuse : l'élève n'a rien à faire.
 */
export function useMiseAJour(activee: boolean = miseAJourActivee()) {
  const [infos, setInfos] = useState<InfosMiseAJour>(INITIAL);
  const reporte = useRef(false);
  const occupe = useRef(false);
  const obligatoireRef = useRef(false);

  const verifier = useCallback(async () => {
    if (!activee || occupe.current) return;
    occupe.current = true;
    try {
      const res = (await Updates.checkForUpdateAsync()) as ResultatVerification;
      if (!res.isAvailable) return;
      const obligatoire = estObligatoire(res.manifest);
      obligatoireRef.current = obligatoire;
      setInfos((cur) => (cur.etat === 'aucune' ? { etat: 'disponible', obligatoire, erreur: null } : { ...cur, obligatoire: cur.obligatoire || obligatoire }));
    } catch {
      // Pas de réseau ou serveur indisponible : on réessaiera au prochain retour au premier plan.
    } finally {
      occupe.current = false;
    }
  }, [activee]);

  useEffect(() => {
    if (!activee) return;
    verifier();
    const abo = AppState.addEventListener('change', (s) => {
      if (s === 'active') verifier();
    });
    return () => abo.remove();
  }, [activee, verifier]);

  const installer = useCallback(async () => {
    if (!activee) return;
    occupe.current = true;
    setInfos((cur) => ({ ...cur, etat: 'telechargement', erreur: null }));
    try {
      await Updates.fetchUpdateAsync();
      setInfos((cur) => ({ ...cur, etat: 'prete' }));
      await Updates.reloadAsync();
    } catch (e) {
      setInfos((cur) => ({ ...cur, etat: 'erreur', erreur: e instanceof Error ? e.message : String(e) }));
    } finally {
      occupe.current = false;
    }
  }, [activee]);

  const plusTard = useCallback(() => {
    if (obligatoireRef.current) return;
    reporte.current = true;
    setInfos((cur) => (cur.obligatoire ? cur : { ...INITIAL }));
  }, []);

  // Une proposition reportée ne revient pas avant la prochaine ouverture ; une obligatoire revient toujours.
  const visible = infos.etat !== 'aucune' && (!reporte.current || infos.obligatoire);

  return { ...infos, visible, installer, plusTard, verifier };
}
