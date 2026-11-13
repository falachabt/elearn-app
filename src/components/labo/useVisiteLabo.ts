import { useCallback, useEffect, useRef } from 'react';

import { marquerVisiteLaboVue, visiteLaboDejaVue } from '@/services/laboVisite';

import { useVisite, type EtapeVisite } from '../Visite';

/**
 * Visite guidée du labo « chat interactif » (bibliothèque de visite de l'app, composant `Visite`) : se lance
 * seule à la première ouverture de l'écran, une fois les éléments mesurables. À la fin, le drapeau est
 * persisté ; si l'élève est allé au bout (pas « Passer »), `surTerminee` est appelé — l'écran y branche
 * la démonstration concrète (l'exemple du pendule lancé pour de vrai) et le passage de main (un exemple
 * pré-rempli dans le champ, que l'élève envoie ou remplace).
 */
export function useVisiteLabo(construire: () => EtapeVisite[], surTerminee: () => void) {
  const { demarrer } = useVisite();
  const construireRef = useRef(construire);
  const surTermineeRef = useRef(surTerminee);
  const demarrerRef = useRef(demarrer);
  useEffect(() => {
    construireRef.current = construire;
    surTermineeRef.current = surTerminee;
    demarrerRef.current = demarrer;
  });

  const lancer = useCallback(() => {
    demarrerRef.current(construireRef.current(), (terminee) => {
      void marquerVisiteLaboVue();
      if (terminee) surTermineeRef.current();
    });
  }, []);

  useEffect(() => {
    let actif = true;
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    void visiteLaboDejaVue().then((vue) => {
      if (actif && !vue) minuteur = setTimeout(lancer, 700);
    });
    return () => {
      actif = false;
      if (minuteur) clearTimeout(minuteur);
    };
    // Une seule fois par ouverture de l'écran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return lancer;
}
