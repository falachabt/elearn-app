import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { abonnerAffichage, chargerAffichage, lireAffichage, type ReglageTheme } from '@/services/affichage';

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
  const valeur = useMemo(
    () => ({ theme: sombre ? themes.dark : themes.light, sombre, reglage, taille: affichage.taille }),
    [sombre, reglage, affichage.taille],
  );
  return <ThemeContext.Provider value={valeur}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
