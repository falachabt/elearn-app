import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { Appearance, useColorScheme, useWindowDimensions } from 'react-native';

import { appliquerCouleurNavigateur } from '@/services/couleurNavigateur';
import { abonnerAffichage, chargerAffichage, lireAffichage, lireTailleEffective, signalerEcran, type ReglageTheme } from '@/services/affichage';

import { themes, type Theme } from './theme';

type Valeur = { theme: Theme; sombre: boolean; reglage: ReglageTheme; taille: number };

const ThemeContext = createContext<Valeur>({ theme: themes.light, sombre: false, reglage: 'systeme', taille: 90 });

/**
 * Le thème suit le réglage Clair / Sombre / Système de Paramètres (Système par défaut). `reglage` force une valeur
 * (tests, captures) ; sinon le réglage gardé sur le téléphone est lu au démarrage.
 * La taille du texte fait partie de la valeur : quand elle change, tout ce qui lit `useTheme` est redessiné.
 */
export function ThemeProvider({ reglage: force, children }: { reglage?: ReglageTheme; children: ReactNode }) {
  const systeme = useColorScheme();
  const affichage = useSyncExternalStore(abonnerAffichage, lireAffichage, lireAffichage);
  // Taille de l'écran (plus petite dimension, en dp) : sert au mode automatique de la taille du texte.
  const { width, height } = useWindowDimensions();
  useEffect(() => {
    signalerEcran(Math.min(width, height));
  }, [width, height]);
  useEffect(() => {
    void chargerAffichage();
  }, []);
  const reglage = force ?? affichage.theme;
  const sombre = reglage === 'systeme' ? systeme === 'dark' : reglage === 'sombre';
  // Réglage manuel : aligne aussi le mode nuit du système sur l'app (icônes de la barre de navigation Android, clavier).
  useEffect(() => {
    try {
      // 'unspecified' rend la main au système. Jamais `null` : le module natif Android le refuse (NullPointerException, crash au démarrage).
      Appearance.setColorScheme(reglage === 'systeme' ? 'unspecified' : sombre ? 'dark' : 'light');
    } catch {
      // Non disponible (web, tests) : sans effet.
    }
  }, [reglage, sombre]);
  // Web : la barre du navigateur prend le fond de l'app.
  useEffect(() => {
    appliquerCouleurNavigateur((sombre ? themes.dark : themes.light).fond.app);
  }, [sombre]);
  // Taille effective : le réglage de l'élève, ou la taille automatique de l'écran (recalculée à chaque publication).
  const valeur = useMemo(
    () => ({ theme: sombre ? themes.dark : themes.light, sombre, reglage, taille: lireTailleEffective() }),
    // `affichage` change à chaque publication (taille choisie, écran, thème) : c'est le signal de redessin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sombre, reglage, affichage],
  );
  return <ThemeContext.Provider value={valeur}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/**
 * Force le thème sombre sur un sous-arbre (écran d'examen, qui reste sombre dans les deux thèmes). Sans effet de bord :
 * le réglage de l'app, la barre du navigateur et le mode nuit du système ne changent pas.
 */
export function ForcerSombre({ children }: { children: ReactNode }) {
  const courant = useContext(ThemeContext);
  const valeur = useMemo(() => ({ ...courant, theme: themes.dark, sombre: true }), [courant]);
  return <ThemeContext.Provider value={valeur}>{children}</ThemeContext.Provider>;
}
