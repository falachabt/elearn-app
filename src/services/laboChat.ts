/**
 * Labo « chat interactif » (prototype réservé à la page développeur) : forme des réponses de l'assistant et
 * réponses de démonstration locales, gardées comme repli visible quand le moteur est injoignable.
 *
 * Principe retenu : l'assistant renvoie des **données** (texte + blocs décrits par leurs paramètres), jamais du
 * code à exécuter. L'app interprète chaque bloc avec ses propres composants (design system, thèmes, hors ligne,
 * tests). Les vraies réponses viennent de la fonction serveur « conversation » (voir services/conversation.ts) ;
 * ces fixtures ont exactement la même forme.
 */

import type { SceneChat } from './laboScene';

/** Une étape de correction : titre court et détail (calcul ou raisonnement), comme dans la correction par photo. */
export type EtapeCorrectionChat = { titre: string; detail: string };

export type BlocChat =
  | { type: 'texte'; texte: string }
  /** Photo envoyée par l'élève : `uri` de la vraie photo choisie ; sans `uri`, le dessin de démonstration (repli). */
  | { type: 'photo'; sujet?: 'pendule'; uri?: string }
  /**
   * Correction structurée d'un exercice photographié : mêmes rubriques que la correction par photo de l'app
   * (énoncé relu, méthode, étapes, résultat, à retenir), rendue par le même composant d'affichage.
   */
  | { type: 'correction'; enonce: string; methode: string; etapes: EtapeCorrectionChat[]; resultat: string; aRetenir?: string }
  /** Simulation du pendule ; paramètres éventuels du problème ou de la photo, repris comme valeurs de départ des curseurs. */
  | { type: 'pendule'; longueur?: number; amplitudeDeg?: number; pesanteur?: number }
  | { type: 'fonction'; a: number; b: number; c: number }
  /**
   * Scène déclarative libre composée par le moteur (circuit, masse-ressort, molécule…) : une donnée validée
   * par `validerScene`, rendue par le moteur natif du labo — aucun code exécuté, valeurs recalculées par l'app.
   */
  | { type: 'scene'; scene: SceneChat };

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
      'Salut ! Filme un exercice ou pose-moi une question : je t’explique, et je te montre en interactif quand ça aide.',
  },
];

/** Réponse à un message libre quand le moteur est injoignable : pas de réponse préparée, l'écran la présente comme un repli. */
export const BLOCS_REPONSE_LIBRE: BlocChat[] = [
  {
    type: 'texte',
    texte:
      "Je n'ai pas de réponse préparée pour cette question. Essaie les suggestions « Montre-moi le pendule » ou « Trace f(x) = 2x² + 3x + 4 » ci-dessous, ou repose ta question quand le moteur répondra.",
  },
];

/** Réponses de démonstration, une par suggestion. Même forme que les futures réponses du serveur. */
export function blocsReponseDemo(invite: InviteDemo): BlocChat[] {
  if (invite === 'photoSeule') {
    // Photo seule : la correction structurée, avec les rubriques de la correction par photo (énoncé, méthode,
    // étapes, résultat, à retenir) — la démo la simule sous la même forme que la réponse du moteur.
    return [
      {
        type: 'correction',
        enonce: 'Un pendule simple de longueur $L = 1$ m est lâché depuis un angle de 30°. Calculer sa période d’oscillation.',
        methode: 'Pour les petits angles, la période d’un pendule simple vaut $T = 2\\pi\\sqrt{\\frac{L}{g}}$, avec $g = 9{,}8$ N/kg.',
        etapes: [
          { titre: 'Identifier les données', detail: 'Longueur du fil : $L = 1$ m. Pesanteur : $g = 9{,}8$ N/kg.' },
          { titre: 'Appliquer la formule', detail: '$T = 2\\pi\\sqrt{\\frac{1}{9{,}8}}$' },
          { titre: 'Calculer', detail: '$T \\approx 2{,}01$ s : la bille fait donc environ 30 oscillations par minute.' },
        ],
        resultat: '$T \\approx 2{,}01$ s',
        aRetenir: 'La période ne dépend que de la longueur du fil et de la pesanteur — ni de la masse, ni de l’amplitude (petits angles).',
      },
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
