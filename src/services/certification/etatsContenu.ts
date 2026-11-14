import type { FamilleNotion, NotionListee } from './types';

/**
 * Les cinq états d'une unité de cours (cahier v1.32, D-43 ; maquette TOEIC-V34-TUILE-ETATS) :
 * Non vu, Vu, Validé, Maîtrisé, À revoir.
 */
export type EtatContenu = 'non_vu' | 'vu' | 'valide' | 'maitrise' | 'a_revoir';

export const ETATS_CONTENU: readonly EtatContenu[] = ['non_vu', 'vu', 'valide', 'maitrise', 'a_revoir'];

type Source = Pick<NotionListee, 'etat' | 'reponses' | 'derniereOuverture'>;

/**
 * État d'une notion calculé à partir des données déjà servies par `cert_notions_list` (ouverture, réponses, maîtrise F3).
 * `cert_content_progress_get` n'est pas encore branché côté app : en attendant, on ne devine aucun seuil nouveau.
 * - jamais ouverte ni répondue : Non vu ;
 * - maîtrise F3 « acquise » : Maîtrisé ; « en progrès » : Validé ;
 * - maîtrise F3 « fragile » (réponses données, trop de ratés) : À revoir ;
 * - sinon (ouverte, pas assez de réponses pour une maîtrise) : Vu.
 */
export function etatContenu(n: Source): EtatContenu {
  const touchee = n.derniereOuverture !== null || n.reponses > 0;
  if (!touchee) return 'non_vu';
  if (n.etat === 'acquise') return 'maitrise';
  if (n.etat === 'en_progres') return 'valide';
  if (n.etat === 'fragile') return 'a_revoir';
  return 'vu';
}

/** Notions d'une famille qui ont une fiche publiée : ce que la grille de Cours affiche. */
export const notionsDeLaFamille = (notions: NotionListee[], famille: FamilleNotion): NotionListee[] => notions.filter((n) => n.fiche && n.famille === famille);

/**
 * Jauge « Maîtrise de la catégorie » : part des notions de la famille Validées ou Maîtrisées, en pourcent entier.
 * Calculée sur les fiches publiées ; 0 quand la famille est vide.
 */
export function maitriseDeLaFamille(notions: NotionListee[], famille: FamilleNotion): number {
  const liste = notionsDeLaFamille(notions, famille);
  if (liste.length === 0) return 0;
  const faites = liste.filter((n) => {
    const e = etatContenu(n);
    return e === 'valide' || e === 'maitrise';
  }).length;
  return Math.round((faites / liste.length) * 100);
}

/** Priorité du bouton « Continuer » : à revoir d'abord, puis vu, puis pas encore vu. Validé et Maîtrisé passent en dernier. */
const RANG_CONTINUER: Record<EtatContenu, number> = { a_revoir: 0, vu: 1, non_vu: 2, valide: 3, maitrise: 4 };

/** Prochaine notion de la famille à travailler ; `null` si la famille n'a aucune fiche. */
export function notionPourContinuer(notions: NotionListee[], famille: FamilleNotion): NotionListee | null {
  const liste = notionsDeLaFamille(notions, famille);
  if (liste.length === 0) return null;
  return liste
    .map((n, ordre) => ({ n, ordre }))
    .sort((a, b) => RANG_CONTINUER[etatContenu(a.n)] - RANG_CONTINUER[etatContenu(b.n)] || a.ordre - b.ordre)[0]!.n;
}

/** « Quiz liés » : réponses justes sur réponses données pour la notion (questions liées par ses étiquettes). `null` sans réponse. */
export function quizLies(n: Pick<NotionListee, 'reponses' | 'reussies'>): { reussis: number; total: number } | null {
  return n.reponses > 0 ? { reussis: n.reussies, total: n.reponses } : null;
}
