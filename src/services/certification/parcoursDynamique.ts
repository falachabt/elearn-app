import { ecartJours, jourPlus, lundiDe, joursAvantTest, type Jour } from './jours';
import { etatRejeuApres, type EtatRejeu } from './certRejeu';

/**
 * Parcours dynamique TOEIC (logique validée par Benny le 17 novembre 2026, document « parcours-explication-et-proposition »).
 * Fonctions pures : aucun accès au stockage ni au réseau. Les nombres ci-dessous sont les choix recommandés validés ;
 * ils ne sont pas des montants et ne touchent pas aux crédits.
 */

/** Une erreur dans la file « À reprendre ». `erreurLe` est le jour de la réponse fausse. */
export type ErreurFile = { questionId: string; notionId: string; erreurLe: Jour; etat: EtatRejeu };

/** Questions de pratique juste après une leçon : 5, 10 si la séance dure 30 minutes. */
export function questionsApresLecon(minutes: number): number {
  return minutes >= 30 ? 10 : 5;
}

/** Une erreur reste à reprendre tant qu'elle n'est pas sortie après deux bonnes réponses de suite (certRejeu). */
export function estAReprendre(erreur: ErreurFile): boolean {
  return erreur.etat.prochaineRevue !== null;
}

/** Erreurs encore dans la file, dans l'ordre reçu. */
export function fileAReprendre(erreurs: ErreurFile[]): ErreurFile[] {
  return erreurs.filter(estAReprendre);
}

/** Enregistre une réponse sur une question de la file : juste ou fausse, selon la règle de certRejeu. */
export function repondreDansLaFile(erreur: ErreurFile, juste: boolean, jour: Jour, r: { delaisRejeuJours: number[]; rejeuRetraitApres: number }): ErreurFile {
  return { ...erreur, etat: etatRejeuApres(erreur.etat, juste, jour, r) };
}

/** Lundi à dimanche qui contient `jour`, bornes incluses (`debut` et `fin`). */
export function semaineDe(jour: Jour): { debut: Jour; fin: Jour } {
  const debut = lundiDe(jour);
  return { debut, fin: jourPlus(debut, 6) };
}

/**
 * Revue du samedi : toutes les erreurs de la semaine (lundi à dimanche) qui sont encore dans la file.
 * Une erreur sortie de la file pendant la semaine n'y revient pas.
 */
export function revueDeLaSemaine(erreurs: ErreurFile[], aujourdhui: Jour): ErreurFile[] {
  const { debut, fin } = semaineDe(aujourdhui);
  return fileAReprendre(erreurs).filter((e) => e.erreurLe >= debut && e.erreurLe <= fin);
}

/**
 * Mélange (entrelacement) : répartit les éléments par notion et les intercale à tour de rôle, pour qu'une même notion
 * ne revienne pas deux fois de suite quand c'est possible. L'ordre relatif à l'intérieur d'une notion est conservé.
 */
export function melanger<T extends { notionId: string }>(elements: T[]): T[] {
  const groupes = new Map<string, T[]>();
  for (const e of elements) groupes.set(e.notionId, [...(groupes.get(e.notionId) ?? []), e]);
  const listes = [...groupes.values()];
  const sortie: T[] = [];
  let reste = true;
  for (let rang = 0; reste; rang++) {
    reste = false;
    for (const liste of listes) {
      if (rang < liste.length) {
        sortie.push(liste[rang]);
        reste = true;
      }
    }
  }
  return sortie;
}

/** Mini-test : une fois par semaine. Jamais fait : dû tout de suite. */
export function miniTestDu(dernier: Jour | null, aujourdhui: Jour): boolean {
  return dernier === null || ecartJours(dernier, aujourdhui) >= 7;
}

/** Test complet : tous les 15 jours, et à J-7 de l'examen (date de test connue). */
export function testCompletDu(dernier: Jour | null, dateTest: Jour | null, aujourdhui: Jour): boolean {
  if (dateTest && joursAvantTest(dateTest, aujourdhui) === 7) return true;
  return dernier === null ? false : ecartJours(dernier, aujourdhui) >= 15;
}

export type EtapeJour =
  | { type: 'pratique'; notionId: string; questions: number }
  | { type: 'rappel_mots'; mots: number }
  | { type: 'a_reprendre'; questions: number }
  | { type: 'serie'; minutes: number }
  | { type: 'revue_semaine'; questions: number }
  | { type: 'mini_test' };

export type EntreeJour = {
  aujourdhui: Jour;
  minutes: number;
  /** Notion de la leçon lue aujourd'hui, si elle est faite. */
  leconDuJour: string | null;
  erreurs: ErreurFile[];
  motsEchus: number;
  dernierMiniTest: Jour | null;
};

/**
 * Composition d'une journée, dans l'ordre affiché : pratique après la leçon, mots, « À reprendre », série,
 * puis la revue (samedi) et le mini-test quand ils sont dus. Un bloc sans contenu est omis.
 */
export function composerJournee(e: EntreeJour): EtapeJour[] {
  const etapes: EtapeJour[] = [];
  if (e.leconDuJour) etapes.push({ type: 'pratique', notionId: e.leconDuJour, questions: questionsApresLecon(e.minutes) });
  if (e.motsEchus > 0) etapes.push({ type: 'rappel_mots', mots: e.motsEchus });
  const file = fileAReprendre(e.erreurs);
  if (file.length > 0) etapes.push({ type: 'a_reprendre', questions: Math.min(file.length, 4) });
  etapes.push({ type: 'serie', minutes: e.minutes });
  if (new Date(`${e.aujourdhui}T12:00:00Z`).getUTCDay() === 6) {
    const revue = revueDeLaSemaine(e.erreurs, e.aujourdhui);
    if (revue.length > 0) etapes.push({ type: 'revue_semaine', questions: revue.length });
  }
  if (miniTestDu(e.dernierMiniTest, e.aujourdhui)) etapes.push({ type: 'mini_test' });
  return etapes;
}

/** Seuil de validation validé par Benny (17 novembre 2026) : 80 % de l'objectif, ou 80 % des questions prévues. */
export const SEUIL_VALIDATION = 0.8;

/**
 * Pratique après une leçon : validée seulement si toutes les questions prévues sont faites ET qu'au moins 80 % sont justes
 * (5 questions : 4 justes minimum). « 3 questions sur 10 » ne valide rien.
 */
export function pratiqueValidee(justes: number, faites: number, prevues: number): boolean {
  if (prevues <= 0 || faites < prevues) return false;
  return justes >= Math.ceil(SEUIL_VALIDATION * prevues);
}

/** Test (mini-test ou test complet) : validé si le score atteint 80 % de l'objectif fixé (objectif 800 : seuil 640). */
export function testValide(score: number, objectif: number): boolean {
  if (objectif <= 0) return false;
  return score >= Math.ceil(SEUIL_VALIDATION * objectif);
}

/** État affiché sur la timeline : rien fait, validé, ou fait mais à refaire (rouge). */
export type EtatValidation = 'a_faire' | 'validee' | 'a_refaire';

export function etatPratique(faites: number, justes: number, prevues: number): EtatValidation {
  if (faites === 0) return 'a_faire';
  return pratiqueValidee(justes, faites, prevues) ? 'validee' : faites < prevues ? 'a_faire' : 'a_refaire';
}

export function etatTest(score: number | null, objectif: number): EtatValidation {
  if (score === null) return 'a_faire';
  return testValide(score, objectif) ? 'validee' : 'a_refaire';
}
