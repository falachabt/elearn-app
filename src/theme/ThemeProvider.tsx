import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { themes, type Theme } from './theme';

type Reglage = 'clair' | 'sombre' | 'systeme';

type Valeur = { theme: Theme; sombre: boolean };

const ThemeContext = createContext<Valeur>({ theme: themes.light, sombre: false });

/** Le thème suit le réglage Clair / Sombre / Système du profil (Système par défaut). */
export function ThemeProvider({ reglage = 'systeme', children }: { reglage?: Reglage; children: ReactNode }) {
  const systeme = useColorScheme();
  const sombre = reglage === 'systeme' ? systeme === 'dark' : reglage === 'sombre';
  const valeur = useMemo(() => ({ theme: sombre ? themes.dark : themes.light, sombre }), [sombre]);
  return <ThemeContext.Provider value={valeur}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
