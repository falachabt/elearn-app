import LottieView, { type LottieViewProps } from 'lottie-react-native';

import { useReduireAnimations } from './useReduireAnimations';

/** Sur le web, `lottie-react-native` exige `@lottiefiles/dotlottie-react` : `Animation.web.tsx` le remplace (repli vide). */
export type AnimationProps = Omit<LottieViewProps, 'autoPlay' | 'loop' | 'progress'> & {
  /** Lecture automatique (ignorée si « Réduire les animations » est actif). */
  lecture?: boolean;
  boucle?: boolean;
  /** Image affichée quand les animations sont réduites, de 0 (début) à 1 (fin). Défaut : fin. */
  imageFixe?: number;
};

/** Animation Lottie (`source` = JSON Lottie). Avec « Réduire les animations », affiche une image fixe au lieu de jouer. */
export function Animation({ lecture = true, boucle = false, imageFixe = 1, ...reste }: AnimationProps) {
  const reduit = useReduireAnimations();
  if (reduit) return <LottieView {...reste} progress={imageFixe} autoPlay={false} loop={false} />;
  return <LottieView {...reste} autoPlay={lecture} loop={boucle} />;
}
