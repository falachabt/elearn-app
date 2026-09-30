// Tous les textes de l'interface passent par ici (anglais prévu : M14-05).
export const fr = {
  accueil: { titre: 'Elearn Prepa', accroche: 'Le tuteur de poche.' },
  erreur: {
    titre: 'Oups',
    banniere: 'Un problème est survenu',
    texte: 'L’erreur a été enregistrée. Réessayez ; si cela persiste, relancez l’application.',
    reessayer: 'Réessayer',
  },
  actions: { commencer: 'Commencer', plusTard: 'Plus tard' },
} as const;

export type Textes = typeof fr;
export const t = fr;
