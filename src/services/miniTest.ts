import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import { questionsPour, type Matiere, type Question } from '@/contenu/miniTest';

/** Question prête à afficher : choix mélangés, `bonne` recalculé sur l'ordre affiché. */
export type QuestionTiree = Omit<Question, 'choix' | 'bonne'> & {
  choix: string[];
  bonne: number;
  /** Nom de matière venu du contenu (mission du jour) ; sinon celui de `matiere`. */
  libelleMatiere?: string | null;
};

/** Mélange de Fisher-Yates ; `aleatoire` injectable pour les tests. */
export function melanger<T>(liste: readonly T[], aleatoire: () => number = Math.random): T[] {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(aleatoire() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

/** Tire le mini-test (5 questions, M1-03) de la classe ou du concours : ordre des questions gardé, choix mélangés. */
export function tirerMiniTest(niveau?: string | null, aleatoire: () => number = Math.random): QuestionTiree[] {
  return questionsPour(niveau).map((q) => {
    const ordre = melanger([0, 1, 2, 3], aleatoire);
    return { ...q, choix: ordre.map((i) => q.choix[i]), bonne: ordre.indexOf(q.bonne) };
  });
}

export type BilanChapitre = { chapitre: string; matiere: Matiere; bonnes: number; total: number };

export type ResultatMiniTest = {
  niveau: string;
  score: number;
  total: number;
  chapitres: BilanChapitre[];
  /** Chapitre réussi en entier, le plus fourni ; absent si aucun chapitre sans faute. */
  pointFort?: BilanChapitre;
  /** Chapitre avec le plus d'erreurs ; absent si tout est juste. */
  aRevoir?: BilanChapitre & { erreurs: number };
  dureeS: number;
  date: string;
};

/** Score, point fort et point à revoir (A5), calculés par chapitre. `reponses[i]` : indice choisi pour la question i. */
export function calculerResultat(questions: readonly QuestionTiree[], reponses: readonly number[], p: { niveau: string; dureeS: number; date?: Date }): ResultatMiniTest {
  const parChapitre = new Map<string, BilanChapitre>();
  let score = 0;
  questions.forEach((q, i) => {
    const juste = reponses[i] === q.bonne;
    if (juste) score++;
    const b = parChapitre.get(q.chapitre) ?? { chapitre: q.chapitre, matiere: q.matiere, bonnes: 0, total: 0 };
    b.total++;
    if (juste) b.bonnes++;
    parChapitre.set(q.chapitre, b);
  });
  const chapitres = [...parChapitre.values()];
  const reussis = chapitres.filter((c) => c.bonnes === c.total).sort((a, b) => b.total - a.total);
  const rates = chapitres.filter((c) => c.bonnes < c.total).sort((a, b) => b.total - b.bonnes - (a.total - a.bonnes));
  return {
    niveau: p.niveau,
    score,
    total: questions.length,
    chapitres,
    pointFort: reussis[0],
    aRevoir: rates[0] ? { ...rates[0], erreurs: rates[0].total - rates[0].bonnes } : undefined,
    dureeS: Math.max(0, Math.round(p.dureeS)),
    date: (p.date ?? new Date()).toISOString(),
  };
}

/** Message du score (A5) selon la réussite. */
export function appreciation(r: Pick<ResultatMiniTest, 'score' | 'total'>): 'excellent' | 'bien' | 'moyen' | 'debut' {
  const taux = r.total ? r.score / r.total : 0;
  if (taux === 1) return 'excellent';
  if (taux >= 0.6) return 'bien';
  if (taux >= 0.4) return 'moyen';
  return 'debut';
}

export const CLE_RESULTAT = 'miniTest.resultat';
type Stocke = ResultatMiniTest & { synchronisePour?: string };

/** Dernier résultat gardé sur le téléphone (M1-04 : progression d'invité conservée localement). */
export async function lireResultat(): Promise<ResultatMiniTest | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE_RESULTAT);
    return brut ? (JSON.parse(brut) as Stocke) : null;
  } catch {
    return null;
  }
}

export async function enregistrerResultat(r: ResultatMiniTest): Promise<void> {
  try {
    await AsyncStorage.setItem(CLE_RESULTAT, JSON.stringify(r));
  } catch {
    // Non mémorisé : le score reste affiché pour cette session.
  }
}

type Client = Pick<SupabaseClient, 'auth' | 'from'>;

/**
 * Envoie le résultat local au compte courant (invité compris) dans `first_results`, une fois par utilisateur.
 * L'invité qui crée son compte garde le même identifiant : rien à refaire. Si le compte change (connexion Apple ou
 * ancien compte), le résultat est renvoyé pour le nouvel utilisateur (M1-04). Ne lève jamais : réessayé plus tard.
 */
export async function synchroniserResultat(client: Client): Promise<boolean> {
  try {
    const brut = await AsyncStorage.getItem(CLE_RESULTAT);
    if (!brut) return false;
    const r = JSON.parse(brut) as Stocke;
    const { data } = await client.auth.getSession();
    const utilisateur = data.session?.user.id;
    if (!utilisateur || r.synchronisePour === utilisateur) return false;
    const { error } = await client.from('first_results').insert({
      user_id: utilisateur,
      kind: 'mini_test',
      level: r.niveau,
      score: r.score,
      total: r.total,
      details: { chapitres: r.chapitres },
      duration_s: r.dureeS,
      taken_at: r.date,
    });
    if (error) return false;
    await AsyncStorage.setItem(CLE_RESULTAT, JSON.stringify({ ...r, synchronisePour: utilisateur }));
    return true;
  } catch {
    return false;
  }
}

export const CLE_INVITATION = 'invitation.sauvegarde.vue';

/** L'invitation à sauvegarder (A6, M2-05) n'est proposée d'elle-même qu'une fois. */
export async function invitationDejaVue(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CLE_INVITATION)) === '1';
  } catch {
    return true;
  }
}

export async function marquerInvitationVue(): Promise<void> {
  try {
    await AsyncStorage.setItem(CLE_INVITATION, '1');
  } catch {
    // Au pire, reproposée une fois de plus.
  }
}
