import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import { enregistrerCorrection, lireCorrection, type Correction } from './correction';
import { CLE_SESSIONS, enregistrerScore, type SessionQuiz } from './entrainement';
import { calculerResultat, type QuestionTiree } from './miniTest';
import { CLE_DERNIER, CLE_ERREURS, coursRates, lireDernierResultat, type ResultatMission } from './mission';
import { marquerLue, quizReussi } from './reviser';
import { signalerProgressionLocale } from './progressionLocale';

type Refaites = { questions: readonly QuestionTiree[]; reponses: readonly (number | null)[] };

/**
 * Les questions refaites remplacent leur réponse dans la session d'origine (même identifiant de question) : une
 * erreur corrigée passe en juste, une question encore ratée garde sa nouvelle réponse fausse.
 */
export function fusionner(c: Correction, r: Refaites): Correction {
  const nouvelles = new Map(r.questions.map((q, i) => [q.id, r.reponses[i]] as const));
  return { ...c, reponses: c.questions.map((q, i) => (nouvelles.has(q.id) ? (nouvelles.get(q.id) ?? null) : c.reponses[i])) };
}

const scoreDe = (c: Pick<Correction, 'questions' | 'reponses'>) => c.questions.filter((q, i) => c.reponses[i] === q.bonne).length;

/**
 * « Refaire mes erreurs » terminé (M5-10) : met à jour la session d'origine et ce qui en dépend. Leçon validée si le
 * score passe le seuil, résultat de la mission recalculé (score, chapitres, leçons ratées), session du quiz libre et
 * meilleur score. Renvoie la correction mise à jour, ou null s'il n'y avait pas de session d'origine.
 */
export async function appliquerRefaire(r: Refaites, client?: Pick<SupabaseClient, 'rpc' | 'from'>): Promise<Correction | null> {
  const origine = await lireCorrection();
  if (!origine) return null;
  const c = fusionner(origine, r);
  await enregistrerCorrection(c);
  const score = scoreDe(c);
  const total = c.questions.length;
  const ctx = c.contexte;
  // La session fusionnée est déjà enregistrée : un échec d'une mise à jour dépendante (leçon, mission, session libre)
  // ne doit jamais faire croire que la session d'origine n'existe pas, sinon l'écran retomberait sur une « session à
  // part » qui ne contient que les questions refaites, et le prochain « Refaire mes erreurs » serait vide.
  try {
    if (ctx?.type === 'lecon' && quizReussi(score, total)) await marquerLue(ctx.lecon, ctx.cours, client, { score, total });
    if (ctx?.type === 'mission' || (!ctx && c.source === 'mission')) await mettreAJourMission(c);
    if (ctx?.type === 'libre') {
      const toutes = JSON.parse((await AsyncStorage.getItem(CLE_SESSIONS)) ?? '{}') as Record<string, SessionQuiz[]>;
      const liste = (toutes[ctx.quiz] ?? []).map((s) => (s.le === ctx.le ? { ...s, reponses: c.reponses, score } : s));
      await AsyncStorage.setItem(CLE_SESSIONS, JSON.stringify({ ...toutes, [ctx.quiz]: liste }));
      signalerProgressionLocale();
      await enregistrerScore(ctx.quiz, score, total);
    }
  } catch (erreur) {
    console.warn('Impossible de répercuter « Refaire mes erreurs » sur la progression.', erreur);
  }
  return c;
}

/** Recalcule le résultat de la mission sur le téléphone ; la série et le jour ne changent pas. */
async function mettreAJourMission(c: Correction): Promise<void> {
  const r = await lireDernierResultat();
  if (!r || r.total !== c.questions.length) return;
  const base = calculerResultat(c.questions, c.reponses.map((x) => x ?? -1), { niveau: r.niveau, dureeS: r.dureeS });
  const ratees = c.questions.filter((q, i) => c.reponses[i] !== q.bonne);
  const suite: ResultatMission = { ...r, score: base.score, chapitres: base.chapitres, pointFort: base.pointFort, coursRates: coursRates(ratees), erreurs: ratees.length };
  await AsyncStorage.multiSet([
    [CLE_DERNIER, JSON.stringify(suite)],
    [CLE_ERREURS, JSON.stringify(ratees)],
  ]);
}
