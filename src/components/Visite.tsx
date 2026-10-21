import { TourGuideOverlay, TourGuideProvider, createTheme, useTourGuide, type TourButtonProps, type TourProgressProps, type TourStep } from '@wrack/react-native-tour-guide';
import { useMemo, type ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { useTraduction } from '@/i18n/useTraduction';
import { useTheme } from '@/theme/ThemeProvider';
import { bord, espace, ombre, rayon, typo } from '@/theme/theme';

import { Appui } from './Appui';
import { Bouton } from './Bouton';

/** Une étape de visite guidée : `cible` est la ref de l'élément à mettre en avant. */
export type EtapeVisite = {
  id: string;
  cible: TourStep['targetRef'];
  titre: string;
  description: string;
  /**
   * Action propre à l'élément mis en avant : un appui sur le halo l'exécute puis passe à l'étape suivante
   * (sauf si elle renvoie `false`, par exemple une photo non prise).
   */
  surCible?: () => boolean | void | Promise<boolean | void>;
};


// Pièces de la carte d'explication, au design de l'app : néo-brutal doux, jetons du thème, clair et sombre.
function Suivant({ label, onPress, disabled }: TourButtonProps) {
  return (
    <View style={styles.bouton}>
      <Bouton petit libelle={label} onPress={onPress} desactive={disabled} />
    </View>
  );
}

function Retour({ label, onPress }: TourButtonProps) {
  return (
    <View style={styles.bouton}>
      <Bouton petit variante="secondaire" libelle={label} onPress={onPress} />
    </View>
  );
}

function Passer({ label, onPress }: TourButtonProps) {
  const { theme } = useTheme();
  return (
    <Appui accessibilityRole="button" accessibilityLabel={label} onPress={onPress} decalage={0} rayon={rayon.s}>
      <View style={styles.passer}>
        <Text style={[typo.boutonPetit, { color: theme.texte.secondaire, textDecorationLine: 'underline' }]}>{label}</Text>
      </View>
    </Appui>
  );
}

function Compteur({ currentStep, totalSteps }: TourProgressProps) {
  const { theme } = useTheme();
  const { t } = useTraduction();
  return (
    // Pastille courte (« 2/5 ») : la rangée du bas tient en 300 dp avec Retour et Suivant, sans rien faire sortir de la carte.
    <View accessible accessibilityLabel={t('visite.etape', { n: currentStep + 1, total: totalSteps })} style={[styles.compteur, { backgroundColor: theme.accent.soleilDoux, borderColor: theme.bord.fort }]}>
      <Text style={[typo.etiquette, { color: theme.texte.surCouleur }]}>{currentStep + 1}/{totalSteps}</Text>
    </View>
  );
}

const COMPOSANTS = { NextButton: Suivant, PrevButton: Retour, SkipButton: Passer, StepCounter: Compteur };

const styles = StyleSheet.create({
  bouton: { paddingRight: ombre.carte, paddingBottom: ombre.carte, flexShrink: 1 },
  passer: { minHeight: 48, justifyContent: 'center', paddingHorizontal: espace[2] },
  compteur: { flexShrink: 0, borderWidth: bord.normal, borderRadius: rayon.pilule, paddingHorizontal: espace[2], paddingVertical: espace[1] },
});

/**
 * Marges de la visite. Sur Android la mesure d'un élément (`measureInWindow`) part déjà du haut de l'écran, barre d'état
 * comprise, comme le calque de la visite : la bibliothèque ne doit donc rien ajouter (`insets.top` à 0, sinon le halo
 * descend de la hauteur de la barre d'état). La barre d'état reste évitée par la carte via `extraInsets`.
 */
export const margesVisite = (haut: number) => ({ insets: { top: 0 }, extraInsets: { top: haut } });

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
  const { top } = useSafeAreaInsets();
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
          skipButtonColor: theme.texte.secondaire,
          titleStyle: { ...typo.h3, fontWeight: undefined },
          descriptionStyle: { ...typo.texte },
          // Bordure de 2 px et ombre dure sans flou (sur Android, bord bas et droit épaissi : `elevation` floute).
          containerStyle: {
            borderWidth: bord.normal,
            borderColor: theme.bord.fort,
            padding: espace[4],
            shadowColor: theme.ombre,
            shadowOffset: { width: ombre.carte, height: ombre.carte },
            shadowOpacity: 1,
            shadowRadius: 0,
            elevation: 0,
            ...(Platform.OS === 'android' ? { borderBottomWidth: bord.normal + ombre.carte, borderRightWidth: bord.normal + ombre.carte } : {}),
          },
          // Pas de flèche : la carte à bordure n'a pas de pointe, le projecteur jaune désigne l'élément.
          arrowStyle: { display: 'none' },
        },
        spotlightStyles: {
          overlayColor: theme.ombre,
          overlayOpacity: 0.72,
          enablePulse: true,
          pulseColor: theme.accent.soleil,
          pulseWidth: 4,
        },
      }),
      ...margesVisite(top),
      components: COMPOSANTS,
      showStepCounter: true,
      nextButtonText: t('visite.suivant'),
      prevButtonText: t('visite.precedent'),
      skipButtonText: t('visite.passer'),
      doneButtonText: t('visite.termine'),
    }),
    [theme, t, top],
  );
  const { nextStep } = reste;
  const demarrer = (etapes: EtapeVisite[], onFin?: (terminee: boolean) => void) =>
    startTour(
      etapes.map((e) => ({
        id: e.id,
        targetRef: e.cible,
        title: e.titre,
        description: e.description,
        ...(e.surCible
          ? {
              onSpotlightPress: () => {
                const action = e.surCible;
                void Promise.resolve(action?.()).then((ok) => {
                  if (ok !== false) nextStep();
                });
              },
            }
          : {}),
      })),
      onFin ? { ...config, onTourEnd: onFin } : config,
    );
  return { demarrer, ...reste };
}
