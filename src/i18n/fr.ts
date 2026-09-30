// Tous les textes de l'interface. Le français est la langue de référence : `en.ts` doit avoir exactement les mêmes clés
// (vérifié par src/i18n/__tests__/i18n.test.ts). Pour ajouter une langue : créer `<code>.ts` typé `Textes` puis
// l'inscrire dans `index.ts`.
export const fr = {
  accueil: {
    titre: 'Elearn Prepa',
    accroche: 'Le tuteur de poche.',
    etiquette: 'Version 3 · socle',
    exercice: 'x + 2 = 5, donc x = ?',
    astuceTitre: 'Astuce',
    astuceTexte: 'Cadre bien tout l\'exercice.',
    champMobileMoney: 'Numéro Mobile Money',
    logoLibelle: 'Logo Elearn Prepa',
  },
  erreur: {
    titre: 'Oups',
    banniere: 'Un problème est survenu',
    texte: 'L’erreur a été enregistrée. Réessayez ; si cela persiste, relancez l’application.',
    reessayer: 'Réessayer',
  },
  onglets: { accueil: 'Accueil', reviser: 'Réviser', photo: 'Photo', questions: 'Questions', moi: 'Moi' },
  ecrans: {
    reviser: 'Leçons courtes et annales, hors ligne.',
    photo: 'Photographie un exercice, reçois la correction pas à pas.',
    questions: 'Pose ta question, l\'IA répond d\'abord.',
    moi: 'Ton profil, tes classes et ton pass.',
  },
  visite: { suivant: 'Suivant', precedent: 'Retour', passer: 'Passer', termine: 'Terminé' },
  actions: { commencer: 'Commencer', plusTard: 'Plus tard' },
} as const;

type Elargi<T> = { [K in keyof T]: T[K] extends string ? string : Elargi<T[K]> };

/** Forme commune à toutes les langues : mêmes clés, textes libres. */
export type Textes = Elargi<typeof fr>;
