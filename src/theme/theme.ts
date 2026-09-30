// Elearn Prepa 2 · jetons de design (source : fichier Figma « Elearn Prepa 2 · Design System & App »)
// À copier dans l'app Expo (ex. src/theme/theme.ts). Les écrans n'utilisent QUE `theme.color.*`,
// jamais la palette directement. Le thème suit le réglage « Clair / Sombre / Système » du profil.

export const palette = {
  emeraude: { 50: '#ECFDF5', 100: '#D1FAE5', 200: '#A7F3D0', 300: '#6EE7B7', 400: '#34D399', 500: '#10B981', 600: '#059669', 700: '#047857', 800: '#065F46', 900: '#064E3B', 950: '#0F3B2E' },
  encre: { 1000: '#0A0A0A', 900: '#141614', 850: '#1F221F', 800: '#2A2E2A', 700: '#3A3F3A', 600: '#3D3D3D', 500: '#5C5C5C', 400: '#9E998C', 300: '#BDB8AA', 200: '#D9D0BA' },
  papier: { 0: '#FFFFFF', 50: '#FFF7E3', 100: '#F6EEDA', 200: '#EDE6D3', 300: '#F6F1E4' },
  soleil: { 100: '#FFF1B8', 400: '#FFD83D', 900: '#3D3514' },
  orange: { 100: '#FFE8CF', 400: '#FF9A3D', 500: '#FF7D00', 900: '#3D2810' },
  corail: { 100: '#FFE1DE', 300: '#FF9F97', 400: '#FF7A70', 500: '#FF5A4F', 700: '#C0271C', 900: '#401B18' },
  bleu: { 100: '#DCE9FF', 300: '#7FB0FF', 400: '#5B9BFF', 500: '#1A75FF', 700: '#1455C7', 900: '#14264A' },
  lilas: { 400: '#B69CFF' }, rose: { 400: '#FF8FB1' }, menthe: { 400: '#8FD2C1' }, herbe: { 400: '#7BC74D' },
} as const;

const p = palette;

// Les deux thèmes partagent la même forme mais pas les mêmes valeurs : on élargit les littéraux en `string`.
type Elargi<T> = { [K in keyof T]: T[K] extends string ? string : Elargi<T[K]> };

const lightValeurs = {
  fond: { app: p.papier[50], surface: p.papier[0], creux: p.papier[100], inverse: p.encre[1000] },
  texte: { principal: p.encre[1000], secondaire: p.encre[500], inverse: p.papier[0], surCouleur: p.encre[1000], lien: p.emeraude[700] },
  bord: { fort: p.encre[1000], doux: p.encre[200] },
  ombre: p.encre[1000],
  marque: { principale: p.emeraude[500], forte: p.emeraude[700], douce: p.emeraude[100] },
  accent: { soleil: p.soleil[400], soleilDoux: p.soleil[100] },
  etat: {
    succes: p.emeraude[500], succesDoux: p.emeraude[100],
    alerte: p.orange[500], alerteDoux: p.orange[100],
    erreur: p.corail[500], erreurDoux: p.corail[100], erreurTexte: p.corail[700],
    info: p.bleu[500], infoDoux: p.bleu[100], infoTexte: p.bleu[700],
  },
  focus: p.bleu[500],
  // Variante « vert » des barres système (essai du 30/09/2026) : icônes noires sur émeraude 500.
  barreVert: p.emeraude[500],
};

export type Theme = Elargi<typeof lightValeurs>;
const light: Theme = lightValeurs;

const dark: Theme = {
  fond: { app: p.encre[900], surface: p.encre[850], creux: p.encre[800], inverse: p.papier[50] },
  texte: { principal: p.papier[300], secondaire: p.encre[400], inverse: p.encre[1000], surCouleur: p.encre[1000], lien: p.emeraude[300] },
  bord: { fort: p.papier[200], doux: p.encre[700] },
  ombre: p.encre[1000],
  marque: { principale: p.emeraude[400], forte: p.emeraude[300], douce: p.emeraude[950] },
  accent: { soleil: p.soleil[400], soleilDoux: p.soleil[900] },
  etat: {
    succes: p.emeraude[400], succesDoux: p.emeraude[950],
    alerte: p.orange[400], alerteDoux: p.orange[900],
    erreur: p.corail[400], erreurDoux: p.corail[900], erreurTexte: p.corail[300],
    info: p.bleu[400], infoDoux: p.bleu[900], infoTexte: p.bleu[300],
  },
  focus: p.bleu[300],
  // En sombre, Android dessine les boutons de navigation en blanc : émeraude 700 garde un contraste suffisant.
  barreVert: p.emeraude[700],
};

// Couleurs de matières : identiques dans les deux thèmes, texte toujours en encre dessus.
export const matiere = {
  maths: p.bleu[400], physique: p.orange[400], svt: p.herbe[400], francais: p.lilas[400],
  anglais: p.rose[400], histoireGeo: p.soleil[400], philo: p.menthe[400],
} as const;

export const espace = { 0: 0, 1: 2, 2: 4, 3: 8, 4: 12, 5: 16, 6: 20, 7: 24, 8: 32, 9: 40, 10: 48, 11: 64 } as const;
export const rayon = { aucun: 0, s: 6, m: 10, l: 14, pilule: 999 } as const;
export const bord = { fin: 1.5, normal: 2, epais: 3 } as const;
// Ombres dures sans flou. Sur Android, `elevation` floute : dessiner l'ombre avec une vue décalée derrière l'élément.
export const ombre = { s: 2, m: 4, l: 6 } as const;
export const cibleMin = 48;

// Polices (SIL OFL) à charger avec expo-font : ArchivoBlack_400Regular, SpaceGrotesk_400/500/700, SpaceMono_400/700.
export const typo = {
  affiche: { fontFamily: 'ArchivoBlack', fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
  h1: { fontFamily: 'ArchivoBlack', fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  h2: { fontFamily: 'ArchivoBlack', fontSize: 21, lineHeight: 26 },
  h3: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 18, lineHeight: 24 },
  chiffreXL: { fontFamily: 'ArchivoBlack', fontSize: 44, lineHeight: 48, letterSpacing: -1 },
  chiffreL: { fontFamily: 'ArchivoBlack', fontSize: 28, lineHeight: 32, letterSpacing: -0.5 },
  texteGrand: { fontFamily: 'SpaceGrotesk-Regular', fontSize: 17, lineHeight: 26 },
  texte: { fontFamily: 'SpaceGrotesk-Regular', fontSize: 16, lineHeight: 24 },
  texteFort: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, lineHeight: 24 },
  petit: { fontFamily: 'SpaceGrotesk-Medium', fontSize: 14, lineHeight: 20 },
  legende: { fontFamily: 'SpaceGrotesk-Medium', fontSize: 13, lineHeight: 18 },
  bouton: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, lineHeight: 20 },
  boutonPetit: { fontFamily: 'SpaceGrotesk-Bold', fontSize: 14, lineHeight: 18 },
  etiquette: { fontFamily: 'SpaceMono-Bold', fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  donnee: { fontFamily: 'SpaceMono-Regular', fontSize: 13, lineHeight: 18 },
} as const;

export const mouvement = { appui: 120, standard: 200, feuille: 300 } as const; // ms ; couper si « réduire les animations »

// Retours (M16) : un seul service appelle ces moments ; aucun écran ne joue un son en direct.
// Sons dans assets/sounds (CC0, voir README). haptique = expo-haptics : 'selection' | 'success' | 'warning' | 'error' | 'light'.
// Source : design/theme.ts du projet.
export const retours = {
  select: { son: 'clic', haptique: 'selection', sonParDefaut: false },
  success: { son: 'bonne-reponse', haptique: 'success' },
  error: { son: 'erreur', haptique: 'error' },
  confirm: { son: 'validation', haptique: 'selection' },
  arrive: { son: 'correction-prete', haptique: 'light' },
  celebrate: { son: 'fin-mission', haptique: 'success' },
  streak: { son: 'serie', haptique: 'success' },
  reward: { son: 'recompense', haptique: 'success' },
  paid: { son: 'paiement-reussi', haptique: 'success' },
  problem: { son: null, haptique: 'warning' }, // réseau, paiement échoué, quota : bannière seulement
  timerWarning: { son: 'alerte-chrono', haptique: 'light' },
  timerEnd: { son: 'fin-epreuve', haptique: 'light' },
} as const;

export const themes = { light, dark };
