import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { profilToeicActif } from '@/services/certification/accueil';

import { useProfilCertification } from './useProfilCertification';

/**
 * `true` quand les onglets TOEIC remplacent ceux de l'élève : drapeau ouvert ET profil certification terminé (A7).
 * `null` tant que le profil se lit, pour ne pas afficher un instant l'accueil de l'élève. Relu à chaque retour sur
 * l'onglet : « Voir mon plan » bascule l'accueil sans relancer l'app.
 */
export function useProfilToeic(): boolean | null {
  const ouvert = useProfilCertification();
  const [actif, setActif] = useState<boolean | null>(null);
  useFocusEffect(
    useCallback(() => {
      let vivant = true;
      void profilToeicActif()
        .catch(() => false)
        .then((v) => vivant && setActif(v));
      return () => {
        vivant = false;
      };
    }, []),
  );
  if (!ouvert) return false;
  return actif;
}
