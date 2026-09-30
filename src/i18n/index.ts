import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { en } from './en';
import { fr, type Textes } from './fr';

export const LANGUE_PAR_DEFAUT = 'fr';
export const langues = { fr, en } satisfies Record<string, Textes>;
export type Langue = keyof typeof langues;
export const languesDisponibles = Object.keys(langues) as Langue[];

/** Chemins pointés de toutes les clés de texte : 'accueil.titre', 'erreur.reessayer'… */
type Chemins<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Chemins<T[K], `${P}${K}.`>;
}[keyof T & string];
export type CleTexte = Chemins<Textes>;

/** Normalise un code ('en-US', 'fr_CA', 'EN') vers une langue prise en charge, sinon `undefined`. */
export function langueSupportee(code?: string | null): Langue | undefined {
  const court = code?.toLowerCase().split(/[-_]/)[0];
  return languesDisponibles.find((l) => l === court);
}

/** Langue de l'appareil (première préférée prise en charge), repli sur le français. */
export function detecterLangue(codes?: readonly (string | null | undefined)[]): Langue {
  let preferes = codes;
  if (!preferes) {
    try {
      preferes = getLocales().map((l) => l.languageTag ?? l.languageCode);
    } catch {
      preferes = [];
    }
  }
  for (const code of preferes) {
    const l = langueSupportee(code);
    if (l) return l;
  }
  return LANGUE_PAR_DEFAUT;
}

export const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  lng: detecterLangue(),
  fallbackLng: LANGUE_PAR_DEFAUT,
  supportedLngs: languesDisponibles,
  interpolation: { escapeValue: false },
  initAsync: false,
  returnNull: false,
});

/** Change la langue de l'interface ; une langue inconnue retombe sur le français. */
export function changerLangue(code: string) {
  return i18n.changeLanguage(langueSupportee(code) ?? LANGUE_PAR_DEFAUT);
}
