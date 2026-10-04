import { useFeedback } from './useFeedback';

/** Vrai quand l'utilisateur a demandé de réduire les animations (réglage du système ou interrupteur de l'app). */
export function useReduireAnimations(): boolean {
  return useFeedback().reduit;
}
