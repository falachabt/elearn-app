import AsyncStorage from '@react-native-async-storage/async-storage';

import { lireEtatHorsLigne } from './horsLigne';
import { lireProgressionEntrainement } from './entrainement';
import { lireLues } from './reviser';
import { lireRythme } from './rythme';

const CLE_ACTIONS = 'accueil.assistantConfiguration.actions';

export type ActionSuivie = 'quiz' | 'correction' | 'fil';

export type ProgressionAssistant = {
  mission: boolean;
  lecon: boolean;
  quiz: boolean;
  exercice: boolean;
  correction: boolean;
  fil: boolean;
  horsLigne: boolean;
  progressionHorsLigne: number | null;
};

export async function noterActionConfiguration(action: ActionSuivie): Promise<void> {
  const brut = await AsyncStorage.getItem(CLE_ACTIONS);
  const actions = brut ? (JSON.parse(brut) as Partial<Record<ActionSuivie, boolean>>) : {};
  if (actions[action]) return;
  await AsyncStorage.setItem(CLE_ACTIONS, JSON.stringify({ ...actions, [action]: true }));
}

export async function lireProgressionAssistant(): Promise<ProgressionAssistant> {
  const [rythme, lecons, entrainement, actionsBrut, horsLigne] = await Promise.all([
    lireRythme(),
    lireLues(),
    lireProgressionEntrainement(),
    AsyncStorage.getItem(CLE_ACTIONS),
    lireEtatHorsLigne(),
  ]);
  const actions = actionsBrut ? (JSON.parse(actionsBrut) as Partial<Record<ActionSuivie, boolean>>) : {};
  const progression = horsLigne ? Object.values(horsLigne.progression) : [];
  const total = progression.reduce((n, categorie) => n + categorie.total, 0);
  const telechargees = progression.reduce((n, categorie) => n + categorie.faites, 0);

  return {
    mission: rythme !== null,
    lecon: Object.keys(lecons).length > 0,
    quiz: !!actions.quiz || Object.values(entrainement.quiz_sessions).some((sessions) => sessions.length > 0),
    exercice: Object.values(entrainement.exercises_done).some(Boolean),
    correction: !!actions.correction,
    fil: !!actions.fil,
    horsLigne: horsLigne?.statut === 'termine',
    progressionHorsLigne: horsLigne ? (total ? Math.floor((telechargees * 100) / total) : 100) : null,
  };
}
