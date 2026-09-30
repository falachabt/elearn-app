import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Vrai quand l'utilisateur a demandé « Réduire les animations » dans les réglages du système. */
export function useReduireAnimations(): boolean {
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
