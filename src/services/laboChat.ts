/**
 * Labo « chat interactif » (prototype réservé à la page développeur) : forme des réponses qu'un assistant peut
 * renvoyer et réponses de démonstration produites localement, sans aucun appel réseau.
 *
 * Principe retenu : l'assistant renvoie des **données** (texte + blocs décrits par leurs paramètres), jamais du
 * code à exécuter. L'app interprète chaque bloc avec ses propres composants (design system, thèmes, hors ligne,
 * tests). Le catalogue de blocs grandit type par type ; ces fixtures ont exactement la forme que renverra la
 * future fonction serveur.
 */

export type BlocChat =
  | { type: 'texte'; texte: string }
  /** Photo envoyée par l'élève (dans la démo : dessin factice du sujet reconnu). */
  | { type: 'photo'; sujet: 'pendule' }
  | { type: 'pendule' }
  | { type: 'fonction'; a: number; b: number; c: number };

export type MessageChat = { id: number; auteur: 'eleve' | 'ia'; blocs: BlocChat[] };

export type InviteDemo = 'pendule' | 'fonction' | 'photo' | 'photoSeule';

/** Période d'un pendule simple aux petits angles, en secondes : T = 2π√(L/g). */
export function periodePendule(longueurM: number, g: number): number {
  return 2 * Math.PI * Math.sqrt(longueurM / g);
}

/** Fréquence d'oscillation, en hertz. */
export function frequencePendule(longueurM: number, g: number): number {
  return 1 / periodePendule(longueurM, g);
}

/** Nombre d'oscillations complètes par minute. */
export function oscillationsParMinute(longueurM: number, g: number): number {
  return 60 * frequencePendule(longueurM, g);
}

/** Angle (degrés) à l'instant `tempsS` d'un pendule lâché sans vitesse depuis `amplitudeDeg`. */
export function anglePendule(amplitudeDeg: number, tempsS: number, periodeS: number): number {
  return amplitudeDeg * Math.cos((2 * Math.PI * tempsS) / periodeS);
}

/** Valeur de f(x) = ax² + bx + c. */
export function valeurFonction(a: number, b: number, c: number, x: number): number {
  return a * x * x + b * x + c;
}

/** Sommet d'une parabole (a ≠ 0) : abscisse −b/(2a). `null` si ce n'est pas une parabole. */
export function sommetFonction(a: number, b: number, c: number): { x: number; y: number } | null {
  if (a === 0) return null;
  const x = -b / (2 * a);
  return { x, y: valeurFonction(a, b, c, x) };
}

/** Points de la courbe entre `min` et `max` inclus, échantillonnés tous les `pas`. */
export function echantillonsFonction(a: number, b: number, c: number, min: number, max: number, pas: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const n = Math.max(1, Math.round((max - min) / pas));
  for (let i = 0; i <= n; i++) {
    const x = min + i * pas;
    points.push({ x, y: valeurFonction(a, b, c, x) });
  }
  return points;
}

/** Nombre au format français : virgule décimale, signe moins typographique. */
export function formaterDecimal(valeur: number, decimales = 2): string {
  return valeur
    .toFixed(decimales)
    .replace('.', ',')
    .replace('-', '−');
}

/** « f(x) = 2x² + 3x + 4 » à partir des coefficients (termes nuls omis, signes gérés). */
export function expressionFonction(a: number, b: number, c: number): string {
  const termes: { signe: '+' | '−'; corps: string }[] = [];
  const ajouter = (coef: number, corps: (abs: number) => string) => {
    if (coef === 0) return;
    termes.push({ signe: coef < 0 ? '−' : '+', corps: corps(Math.abs(coef)) });
  };
  ajouter(a, (v) => (v === 1 ? 'x²' : `${formaterDecimal(v, 0)}x²`));
  ajouter(b, (v) => (v === 1 ? 'x' : `${formaterDecimal(v, 0)}x`));
  ajouter(c, (v) => formaterDecimal(v, 0));
  if (termes.length === 0) return 'f(x) = 0';
  return termes.reduce((acc, t, i) => (i === 0 ? `f(x) = ${t.signe === '−' ? '−' : ''}${t.corps}` : `${acc} ${t.signe} ${t.corps}`), '');
}

/** Message d'accueil affiché à l'ouverture du labo. */
export const BLOCS_BIENVENUE: BlocChat[] = [
  {
    type: 'texte',
    texte:
      "Salut ! Je suis l'assistant de démonstration du labo. Choisis comment poser ta question — une photo, une question écrite, ou les deux — et je peux répondre avec des rendus interactifs à manipuler, directement dans la discussion.",
  },
];

/** Réponse à un message libre : le prototype n'est pas encore branché à un modèle, il le dit. */
export const BLOCS_REPONSE_LIBRE: BlocChat[] = [
  {
    type: 'texte',
    texte:
      "Mode démo : je ne suis pas encore branché à un vrai modèle, je sais seulement montrer les rendus préparés. Essaie les suggestions « Montre-moi le pendule » ou « Trace f(x) = 2x² + 3x + 4 » ci-dessous.",
  },
];

/** Réponses de démonstration, une par suggestion. Même forme que les futures réponses du serveur. */
export function blocsReponseDemo(invite: InviteDemo): BlocChat[] {
  if (invite === 'photoSeule') {
    // Photo seule : c'est le résultat du parcours photo ACTUEL (correction structurée), inchangé — aucun bloc
    // interactif ajouté. La démo le simule avec les mêmes rubriques que la vraie correction (énoncé, méthode,
    // résultat, à retenir).
    return [
      { type: 'texte', texte: "Énoncé (lu sur ta photo) : un pendule simple de longueur L = 1 m est lâché depuis un angle de 30°. Calculer sa période d'oscillation." },
      { type: 'texte', texte: 'Méthode : pour les petits angles, la période vaut T = 2π√(L/g), avec g = 9,8 N/kg.' },
      { type: 'texte', texte: 'Résultat : T ≈ 2,01 s. La bille fait donc environ 30 oscillations par minute.' },
      { type: 'texte', texte: 'À retenir : la période ne dépend que de la longueur du fil et de la pesanteur — ni de la masse, ni de l’amplitude (petits angles).' },
    ];
  }
  if (invite === 'photo') {
    return [
      {
        type: 'texte',
        texte:
          "D'après ta photo, je reconnais un pendule simple : un fil accroché en hauteur, une bille lourde au bout. Voici son mouvement en animation interactive — les mêmes curseurs que si tu me l'avais demandé par écrit :",
      },
      { type: 'pendule' },
      {
        type: 'texte',
        texte:
          "Compare avec ta photo : l'angle de départ correspond à l'amplitude. Si tu mesures la longueur du fil sur ton montage, règle le curseur L sur cette valeur : la période affichée est celle de ton pendule.",
      },
    ];
  }
  if (invite === 'pendule') {
    return [
      {
        type: 'texte',
        texte:
          "Voici le pendule simple : une bille suspendue à un fil de longueur L, lâchée avec un angle de départ (l'amplitude). Fais glisser les curseurs pour voir l'effet de chaque grandeur :",
      },
      { type: 'pendule' },
      {
        type: 'texte',
        texte:
          "À retenir : plus le fil est long, plus la période augmente. Pour de petits angles, l'amplitude ne change presque pas la période — c'est pour cela qu'une horloge à balancier garde un rythme régulier.",
      },
    ];
  }
  return [
    {
      type: 'texte',
      texte: "Voici la courbe de f(x) = 2x² + 3x + 4. Comme a = 2 > 0, la parabole est tournée vers le haut : son minimum est le sommet S, marqué sur le graphe.",
    },
    { type: 'fonction', a: 2, b: 3, c: 4 },
    {
      type: 'texte',
      texte:
        "Méthode : le sommet d'une parabole f(x) = ax² + bx + c est au point d'abscisse x = −b/(2a). Ici : x = −3/4 = −0,75 et f(−0,75) = 23/8 = 2,875. L'ordonnée à l'origine vaut f(0) = 4.",
    },
  ];
}
