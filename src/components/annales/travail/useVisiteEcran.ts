import { useCallback, useEffect, useRef } from 'react';

import { suivre } from '@/services/analytics';
import { marquerVisiteVue, visiteDejaVue, type EcranVisite } from '@/services/travailSujet';

import { useVisite, type EtapeVisite } from '../../Visite';

/**
 * Visite guidée d'un écran de la correction du travail (bibliothèque de visite de l'app) : se lance seule à la première
 * ouverture de l'écran, une fois les éléments mesurables, et `lancer` la rejoue à la demande (bouton d'aide).
 * `construire` est relue à chaque lancement : les références et les étapes conditionnelles sont alors à jour.
 */
export function useVisiteEcran(ecran: EcranVisite, construire: () => EtapeVisite[], pret = true) {
  const { demarrer } = useVisite();
  const construireRef = useRef(construire);
  useEffect(() => {
    construireRef.current = construire;
  });

  const lancer = useCallback(
    () =>
      demarrer(construireRef.current(), (terminee) => {
        void marquerVisiteVue(ecran);
        suivre('annale_visite_vue', { terminee, ecran });
      }),
    [demarrer, ecran],
  );

  useEffect(() => {
    if (!pret) return;
    let actif = true;
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    void visiteDejaVue(ecran).then((vue) => {
      if (actif && !vue) minuteur = setTimeout(lancer, 700);
    });
    return () => {
      actif = false;
      if (minuteur) clearTimeout(minuteur);
    };
    // Une seule fois par ouverture de l'écran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ecran, pret]);

  return lancer;
}
