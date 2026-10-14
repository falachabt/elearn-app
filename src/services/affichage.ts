import AsyncStorage from '@react-native-async-storage/async-storage';

import { typo } from '@/theme/theme';

import { suivre } from './analytics';
import { signalerModification } from './reglagesLocaux';

/**
 * Réglages d'affichage (H2 Paramètres › Apparence) : thème Clair / Sombre / Système et taille du texte.
 * Gardés sur le téléphone ; lus au démarrage par le ThemeProvider.
 */
export type ReglageTheme = 'clair' | 'sombre' | 'systeme';

export const CLE_THEME = 'affichage.theme';
export const CLE_TAILLE = 'affichage.taille';
/** Drapeau : le mode auto a été posé comme défaut (une seule fois, à la mise à jour qui l'introduit). */
export const CLE_TAILLE_AUTO_DEFAUT = 'affichage.tailleAutoDefaut';

/** Tailles proposées, en pour cent de la taille de base. 130 % au plus (consigne d'accessibilité du guide). */
export const TAILLES = [80, 90, 100, 110, 120, 130] as const;
export type TailleTexte = (typeof TAILLES)[number];
/** « auto » : la taille suit la taille de l'écran. Dès que l'élève choisit une taille, le réglage passe en manuel. */
export type ReglageTaille = TailleTexte | 'auto';
export const TAILLE_DEFAUT: ReglageTaille = 'auto';
const TAILLE_MAX = 130;

/** Facteur automatique selon la plus petite dimension de l'écran (en dp) : petit téléphone, téléphone, grand téléphone, tablette. */
export function tailleAuto(dpMin: number): number {
  // Seuils revus sur un Galaxy S25 Ultra (384 dp de large) : 90 % jugé juste par l'élève, 100 % trop grand.
  const facteur = dpMin < 420 ? 90 : dpMin < 600 ? 100 : 110;
  return Math.min(facteur, TAILLE_MAX);
}

/** Taille réellement appliquée : le réglage de l'élève, ou la taille automatique de l'écran. */
export function tailleEffective(reglage: ReglageTaille, dpMinimum: number): number {
  return reglage === 'auto' ? tailleAuto(dpMinimum) : reglage;
}

type Etat = { theme: ReglageTheme; taille: ReglageTaille };

let etat: Etat = { theme: 'systeme', taille: TAILLE_DEFAUT };
/** Plus petite dimension de l'écran, en dp (renseignée par le ThemeProvider). 360 tant qu'elle n'est pas connue. */
let dpMin = 360;
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
  const styles = Object.fromEntries((Object.keys(base) as CleTypo[]).map((k) => [
    k,
    {
      ...typo[k],
      fontSize: Math.round(base[k].fontSize * f * 10) / 10,
      lineHeight: Math.round(base[k].lineHeight * f),
      ...(base[k].letterSpacing !== undefined ? { letterSpacing: base[k].letterSpacing } : {}),
    },
  ]));
  Object.assign(typo, styles);
}

const estTheme = (v: unknown): v is ReglageTheme => v === 'clair' || v === 'sombre' || v === 'systeme';
const estTaille = (v: unknown): v is ReglageTaille => v === 'auto' || TAILLES.includes(v as TailleTexte);

function publier(nouvel: Etat) {
  etat = nouvel;
  appliquerTaille(tailleEffective(etat.taille, dpMin));
  ecouteurs.forEach((f) => f());
}

export const lireAffichage = (): Etat => etat;

/** Taille effective pour l'écran courant (réglage manuel, ou taille automatique). */
export const lireTailleEffective = (): number => tailleEffective(etat.taille, dpMin);

/**
 * Le ThemeProvider signale la taille de l'écran (et ses changements : rotation, fenêtre du navigateur).
 * En mode auto, la taille du texte est recalculée et tout l'écran est redessiné.
 */
export function signalerEcran(dp: number): void {
  if (dp === dpMin) return;
  dpMin = dp;
  if (etat.taille === 'auto') publier({ ...etat });
}

export function abonnerAffichage(f: () => void): () => void {
  ecouteurs.add(f);
  return () => ecouteurs.delete(f);
}

/** Lit les réglages gardés (une seule fois par lancement). Ne lève jamais. */
export function chargerAffichage(): Promise<void> {
  charge ??= (async () => {
    try {
      const [[, theme], [, taille], [, migre]] = await AsyncStorage.multiGet([CLE_THEME, CLE_TAILLE, CLE_TAILLE_AUTO_DEFAUT]);
      const t = taille === 'auto' ? 'auto' : Number(taille);
      // Une seule fois : le mode auto devient le défaut, même pour un réglage manuel gardé avant cette version.
      if (migre !== '1') {
        publier({ theme: estTheme(theme) ? theme : etat.theme, taille: 'auto' });
        await AsyncStorage.multiSet([
          [CLE_TAILLE, 'auto'],
          [CLE_TAILLE_AUTO_DEFAUT, '1'],
        ]).catch(() => {});
        return;
      }
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
  await signalerModification();
}

/** Choix manuel d'une taille : le réglage passe en manuel et garde cette valeur. */
export async function definirTaille(taille: TailleTexte): Promise<void> {
  if (taille === etat.taille) return;
  publier({ ...etat, taille });
  suivre('display_setting_changed', { taille });
  await AsyncStorage.setItem(CLE_TAILLE, String(taille)).catch(() => {});
  await signalerModification();
}

/** Retour au mode automatique : la taille suit de nouveau l'écran. */
export async function definirTailleAuto(): Promise<void> {
  if (etat.taille === 'auto') return;
  publier({ ...etat, taille: 'auto' });
  suivre('display_setting_changed', { taille: lireTailleEffective() });
  await AsyncStorage.setItem(CLE_TAILLE, 'auto').catch(() => {});
  await signalerModification();
}

/** Réglage d'affichage reçu d'un compte : applique et mémorise sans événement utilisateur. */
export async function appliquerAffichage(reglage: Partial<Etat>): Promise<void> {
  const theme = estTheme(reglage.theme) ? reglage.theme : etat.theme;
  const taille = estTaille(reglage.taille) ? reglage.taille : etat.taille;
  publier({ theme, taille });
  await AsyncStorage.multiSet([[CLE_THEME, theme], [CLE_TAILLE, String(taille)]]);
}

/** Pour les tests : revient aux valeurs par défaut. */
export function reinitialiserAffichage(): void {
  charge = null;
  publier({ theme: 'systeme', taille: TAILLE_DEFAUT });
}
