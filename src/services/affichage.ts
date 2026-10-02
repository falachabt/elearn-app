import AsyncStorage from '@react-native-async-storage/async-storage';

import { typo } from '@/theme/theme';

import { suivre } from './analytics';

/**
 * Réglages d'affichage (H2 Paramètres › Apparence) : thème Clair / Sombre / Système et taille du texte.
 * Gardés sur le téléphone ; lus au démarrage par le ThemeProvider.
 */
export type ReglageTheme = 'clair' | 'sombre' | 'systeme';

export const CLE_THEME = 'affichage.theme';
export const CLE_TAILLE = 'affichage.taille';

/** Tailles proposées, en pour cent de la taille de base. 130 % au plus (consigne d'accessibilité du guide). */
export const TAILLES = [90, 100, 110, 120, 130] as const;
export type TailleTexte = (typeof TAILLES)[number];
export const TAILLE_DEFAUT: TailleTexte = 100;

type Etat = { theme: ReglageTheme; taille: TailleTexte };

let etat: Etat = { theme: 'systeme', taille: TAILLE_DEFAUT };
let charge: Promise<void> | null = null;
const ecouteurs = new Set<() => void>();

// Copie des tailles d'origine : la taille du texte se calcule toujours depuis elles.
type CleTypo = keyof typeof typo;
const base = Object.fromEntries(
  (Object.keys(typo) as CleTypo[]).map((k) => [k, { fontSize: typo[k].fontSize, lineHeight: typo[k].lineHeight, letterSpacing: 'letterSpacing' in typo[k] ? typo[k].letterSpacing : undefined }]),
) as Record<CleTypo, { fontSize: number; lineHeight: number; letterSpacing?: number }>;

/**
 * Applique la taille du texte aux styles `typo` partagés par tous les écrans. Les écrans lisent `typo` au rendu ;
 * le ThemeProvider change de valeur en même temps, ce qui redessine tout ce qui utilise `useTheme`.
 * Les tailles fixées à la main dans un écran (rares) ne suivent pas.
 */
export function appliquerTaille(taille: number): void {
  const f = taille / 100;
  for (const k of Object.keys(base) as CleTypo[]) {
    const cible = typo[k] as { fontSize: number; lineHeight: number; letterSpacing?: number };
    cible.fontSize = Math.round(base[k].fontSize * f * 10) / 10;
    cible.lineHeight = Math.round(base[k].lineHeight * f);
    if (base[k].letterSpacing !== undefined) cible.letterSpacing = base[k].letterSpacing;
  }
}

const estTheme = (v: unknown): v is ReglageTheme => v === 'clair' || v === 'sombre' || v === 'systeme';
const estTaille = (v: unknown): v is TailleTexte => TAILLES.includes(v as TailleTexte);

function publier(nouvel: Etat) {
  etat = nouvel;
  appliquerTaille(etat.taille);
  ecouteurs.forEach((f) => f());
}

export const lireAffichage = (): Etat => etat;

export function abonnerAffichage(f: () => void): () => void {
  ecouteurs.add(f);
  return () => ecouteurs.delete(f);
}

/** Lit les réglages gardés (une seule fois par lancement). Ne lève jamais. */
export function chargerAffichage(): Promise<void> {
  charge ??= (async () => {
    try {
      const [[, theme], [, taille]] = await AsyncStorage.multiGet([CLE_THEME, CLE_TAILLE]);
      const t = Number(taille);
      publier({ theme: estTheme(theme) ? theme : etat.theme, taille: estTaille(t) ? t : etat.taille });
    } catch {
      // Valeurs par défaut.
    }
  })();
  return charge;
}

export async function definirTheme(theme: ReglageTheme): Promise<void> {
  publier({ ...etat, theme });
  suivre('display_setting_changed', { theme });
  await AsyncStorage.setItem(CLE_THEME, theme).catch(() => {});
}

export async function definirTaille(taille: TailleTexte): Promise<void> {
  if (taille === etat.taille) return;
  publier({ ...etat, taille });
  suivre('display_setting_changed', { taille });
  await AsyncStorage.setItem(CLE_TAILLE, String(taille)).catch(() => {});
}

/** Pour les tests : revient aux valeurs par défaut. */
export function reinitialiserAffichage(): void {
  charge = null;
  publier({ theme: 'systeme', taille: TAILLE_DEFAUT });
}
