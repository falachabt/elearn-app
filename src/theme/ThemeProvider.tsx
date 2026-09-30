import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { themes, type Theme } from './theme';

type Reglage = 'clair' | 'sombre' | 'systeme';

type Valeur = { theme: Theme; sombre: boolean };

const ThemeContext = createContext<Valeur>({ theme: themes.light, sombre: false });

/** Le thème suit le réglage Clair / Sombre / Système du profil (Système par défaut). */
export function ThemeProvider({ reglage = 'systeme', children }: { reglage?: Reglage; children: ReactNode }) {
  const systeme = useColorScheme();
  const sombre = reglage === 'systeme' ? systeme === 'dark' : reglage === 'sombre';
  // Réglage manuel : aligne aussi le mode nuit du système sur l'app (icônes de la barre de navigation Android, clavier).
  useEffect(() => {
    try {
      // @ts-expect-error `null` rend la main au système (accepté à l'exécution, absent des types de RN 0.86).
      Appearance.setColorScheme(reglage === 'systeme' ? null : sombre ? 'dark' : 'light');
    } catch {
      // Non disponible (web, tests) : sans effet.
    }
  }, [reglage, sombre]);
  const valeur = useMemo(() => ({ theme: sombre ? themes.dark : themes.light, sombre }), [sombre]);
  return <ThemeContext.Provider value={valeur}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
