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
