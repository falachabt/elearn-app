import type { MotCarnetServi, NotionFiche, NotionListee, PartieMaitrise, Revision, SeanceServie } from '../types';
import { questionsTest } from './apiFausse';

/** Notions du jeu d'essai : une par état, sur la partie 5, plus un vocabulaire et un piège sur d'autres parties. */
export const NOTIONS_TEST: NotionListee[] = [
  { id: 'n-forme', code: 'forme', titre: 'Forme du mot', famille: 'grammaire', parties: [5], dureeMin: 3, fiche: true, reponses: 6, reussies: 2, etat: 'fragile', derniereOuverture: null },
  { id: 'n-prepo', code: 'prepo', titre: 'Prépositions de temps', famille: 'grammaire', parties: [5], dureeMin: 3, fiche: true, reponses: 9, reussies: 6, etat: 'en_progres', derniereOuverture: null },
  { id: 'n-passe', code: 'passe', titre: 'Temps du passé', famille: 'grammaire', parties: [5], dureeMin: 4, fiche: true, reponses: 12, reussies: 11, etat: 'acquise', derniereOuverture: null },
  { id: 'n-conn', code: 'conn', titre: 'Connecteurs', famille: 'piege', parties: [6], dureeMin: 3, fiche: true, reponses: 0, reussies: 0, etat: 'pas_commencee', derniereOuverture: null },
  { id: 'n-bureau', code: 'bureau', titre: 'Vocabulaire du bureau', famille: 'vocabulaire', parties: [5, 7], dureeMin: null, fiche: true, reponses: 4, reussies: 2, etat: 'en_progres', derniereOuverture: null },
  { id: 'n-sans', code: 'sans', titre: 'Notion sans fiche', famille: 'methode', parties: [7], dureeMin: null, fiche: false, reponses: 0, reussies: 0, etat: 'pas_commencee', derniereOuverture: null },
];

export const PARTIES_TEST: PartieMaitrise[] = [
  { partie: 1, reponses: 5, m: 0.8, etat: 'acquise' },
  { partie: 2, reponses: 5, m: 0.6, etat: 'en_progres' },
  { partie: 3, reponses: 5, m: 0.7, etat: 'acquise' },
  { partie: 4, reponses: 5, m: 0.4, etat: 'en_progres' },
  { partie: 5, reponses: 27, m: 0.25, etat: 'fragile' },
  { partie: 6, reponses: 5, m: 0.35, etat: 'fragile' },
  { partie: 7, reponses: 0, m: 0, etat: 'pas_commencee' },
];

export const REVISION_TEST: Revision = { notions: NOTIONS_TEST, parties: PARTIES_TEST };

/** Carnet : 2 mots à revoir (dont un échu aujourd'hui), 1 en cours, 1 connu. `JOUR` est la date du jeu d'essai. */
export const JOUR = '2026-10-16';
export const MOTS_TEST: MotCarnetServi[] = [
  { id: 'w-postpone', mot: 'postpone', categorie: 'Verbe', definition: 'reporter, remettre à plus tard', exemple: 'They decided to postpone the meeting.', theme: 'bureau', audio: null, boite: 1, prochaineRevue: JOUR, vus: 2, bons: 0, mauvais: 2 },
  { id: 'w-quarterly', mot: 'quarterly', categorie: 'Adjectif', definition: 'trimestriel', exemple: null, theme: 'finance', audio: null, boite: 1, prochaineRevue: '2026-10-20', vus: 1, bons: 0, mauvais: 1 },
  { id: 'w-deadline', mot: 'deadline', categorie: 'Nom', definition: 'date limite', exemple: null, theme: 'bureau', audio: 'toeic/audio/mots/deadline.mp3', boite: 2, prochaineRevue: JOUR, vus: 3, bons: 2, mauvais: 1 },
  { id: 'w-invoice', mot: 'invoice', categorie: 'Nom', definition: 'facture', exemple: null, theme: 'finance', audio: null, boite: 4, prochaineRevue: '2026-11-30', vus: 6, bons: 6, mauvais: 0 },
];

export const FICHE_TEST: NotionFiche = {
  id: 'n-prepo',
  code: 'prepo',
  famille: 'grammaire',
  titre: 'Prépositions de temps',
  parties: [5],
  markdown: [
    '## Règle',
    '« on » pour un jour ou une date, « at » pour une heure, « in » pour un mois ou une année.',
    '',
    '## Exemples',
    '- We meet **on** Monday. | Nous nous voyons lundi.',
    '- The report is due **by** noon. | Le rapport est dû avant midi.',
    '',
    '## Piège',
    '« until » suit une action qui dure. « by » indique une limite.',
    '',
    '## Faux ami',
    'actually | actuellement',
  ].join('\n'),
  dureeMin: 3,
  ancrages: questionsTest({ 5: 3 }),
};

export const SEANCE_TEST: SeanceServie = {
  minutes: 20,
  blocs: [
    { type: 'cours', notionId: 'n-prepo', titre: 'Prépositions de temps', minutes: 3, erreurs: 4 },
    { type: 'mots', nombre: 2, echus: 2 },
    { type: 'rejeu', nombre: 4, partie: 5 },
    { type: 'serie', partie: 5, nombre: 10 },
  ],
  pourquoi: { erreurs: 4, notion: 'Prépositions de temps', motsEchus: 2 },
};
