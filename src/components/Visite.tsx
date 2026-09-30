import { TourGuideOverlay, TourGuideProvider, createTheme, useTourGuide, type TourStep } from '@wrack/react-native-tour-guide';
import { useMemo, type ReactNode } from 'react';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { rayon } from '@/theme/theme';

/** Une étape de visite guidée : `cible` est la ref de l'élément à mettre en avant. */
export type EtapeVisite = {
  id: string;
  cible: TourStep['targetRef'];
  titre: string;
  description: string;
};

/** À placer une fois à la racine, sous `ThemeProvider` : fournit la visite guidée et son calque. */
export function VisiteProvider({ children }: { children: ReactNode }) {
  return (
    <TourGuideProvider>
      {children}
      <TourGuideOverlay />
    </TourGuideProvider>
  );
}

/** `demarrer(etapes)` lance la visite avec les couleurs du thème (clair/sombre) et les textes traduits. */
export function useVisite() {
  const { startTour, ...reste } = useTourGuide();
  const { theme } = useTheme();
  const { t } = useTraduction();
  const config = useMemo(
    () => ({
      ...createTheme({
        tooltipStyles: {
          backgroundColor: theme.fond.surface,
          borderRadius: rayon.l,
          titleColor: theme.texte.principal,
          descriptionColor: theme.texte.secondaire,
          buttonTextColor: theme.texte.surCouleur,
          primaryButtonColor: theme.marque.principale,
          skipButtonColor: theme.texte.lien,
        },
        spotlightStyles: { overlayColor: theme.ombre, overlayOpacity: 0.7 },
      }),
      nextButtonText: t('visite.suivant'),
      prevButtonText: t('visite.precedent'),
      skipButtonText: t('visite.passer'),
      doneButtonText: t('visite.termine'),
    }),
    [theme, t],
  );
  const demarrer = (etapes: EtapeVisite[]) =>
    startTour(
      etapes.map((e) => ({ id: e.id, targetRef: e.cible, title: e.titre, description: e.description })),
      config,
    );
  return { demarrer, ...reste };
}
