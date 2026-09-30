import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

import { abonnerPreferences, jouerMoment, lirePreferences, type Moment } from '@/services/retours';
import { mouvement } from '@/theme/theme';

/** Vrai quand le système demande de réduire les animations. */
function useReduireSysteme(): boolean {
  const [reduit, setReduit] = useState(false);
  useEffect(() => {
    let actif = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => actif && setReduit(v)).catch(() => {});
    const abo = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduit);
    return () => {
      actif = false;
      abo.remove();
    };
  }, []);
  return reduit;
}

/**
 * Point d'entrée unique des retours d'interaction (son + vibration + animation).
 * `declencher('success')` joue le son et la vibration selon les préférences ; `reduit` dit s'il faut couper les mouvements
 * amples (réglage système ou interrupteur « Animations réduites »). `durees` : appui 120, standard 200, feuille 300 ms.
 */
export function useFeedback() {
  const prefs = useSyncExternalStore(abonnerPreferences, lirePreferences, lirePreferences);
  const systeme = useReduireSysteme();
  const declencher = useCallback((moment: Moment) => void jouerMoment(moment), []);
  return { declencher, reduit: systeme || prefs.animationsReduites, durees: mouvement, preferences: prefs };
}
