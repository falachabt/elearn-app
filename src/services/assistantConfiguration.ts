import AsyncStorage from '@react-native-async-storage/async-storage';

import { lireProgressionEntrainement } from './entrainement';
import { lireLues } from './reviser';
import { lireRythme } from './rythme';
import { getSupabase } from './supabase';

const CLE_ACTIONS = 'accueil.assistantConfiguration.actions';

export type ActionSuivie = 'quiz' | 'correction' | 'fil';

export type ProgressionAssistant = {
  mission: boolean;
  lecon: boolean;
  quiz: boolean;
  exercice: boolean;
  correction: boolean;
  fil: boolean;
};

export async function noterActionConfiguration(action: ActionSuivie): Promise<void> {
  const brut = await AsyncStorage.getItem(CLE_ACTIONS);
  const actions = brut ? (JSON.parse(brut) as Partial<Record<ActionSuivie, boolean>>) : {};
  if (actions[action]) return;
  await AsyncStorage.setItem(CLE_ACTIONS, JSON.stringify({ ...actions, [action]: true }));
}

export async function lireProgressionAssistant(): Promise<ProgressionAssistant> {
  const [rythme, lecons, entrainement, actionsBrut] = await Promise.all([
    lireRythme(),
    lireLues(),
    lireProgressionEntrainement(),
    AsyncStorage.getItem(CLE_ACTIONS),
  ]);
  const actions = actionsBrut ? (JSON.parse(actionsBrut) as Partial<Record<ActionSuivie, boolean>>) : {};
  const [correctionDistante, filDistant] = await Promise.all([
    actions.correction ? Promise.resolve(false) : actionDistante('correction'),
    actions.fil ? Promise.resolve(false) : actionDistante('fil'),
  ]);

  return {
    mission: rythme !== null,
    lecon: Object.keys(lecons).length > 0,
    quiz: !!actions.quiz || Object.values(entrainement.quiz_sessions).some((sessions) => sessions.length > 0),
    exercice: Object.values(entrainement.exercises_done).some(Boolean),
    correction: !!actions.correction || correctionDistante,
    fil: !!actions.fil || filDistant,
  };
}

async function actionDistante(action: 'correction' | 'fil'): Promise<boolean> {
  try {
    const client = getSupabase();
    const { data: session, error: erreurSession } = await client.auth.getSession();
    if (erreurSession) throw erreurSession;
    const userId = session.session?.user.id;
    if (!userId) return false;

    if (action === 'correction') {
      const { data, error } = await client
        .from('photo_corrections')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'done')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    }

    const [posts, commentaires, votes] = await Promise.all([
      client.from('feed_posts').select('id').eq('author_id', userId).limit(1).maybeSingle(),
      client.from('post_comments').select('id').eq('author_id', userId).limit(1).maybeSingle(),
      client.from('poll_votes').select('id').eq('user_id', userId).limit(1).maybeSingle(),
    ]);
    const erreur = posts.error ?? commentaires.error ?? votes.error;
    if (erreur) throw erreur;
    return !!posts.data || !!commentaires.data || !!votes.data;
  } catch (erreur) {
    console.warn(`Impossible de vérifier l’historique de l’étape « ${action} ».`, erreur);
    return false;
  }
}
