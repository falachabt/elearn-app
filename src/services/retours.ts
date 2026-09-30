import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';

import { suivre } from './analytics';

/** Les moments clés de l'app. Les écrans n'appellent jamais un son ou une vibration en direct : ils passent par `useFeedback`. */
export type Moment = 'success' | 'error' | 'select' | 'reward' | 'celebrate';
export const moments: readonly Moment[] = ['success', 'error', 'select', 'reward', 'celebrate'];

export type Preferences = { sons: boolean; vibrations: boolean; animationsReduites: boolean };
export const PREFERENCES_PAR_DEFAUT: Preferences = { sons: true, vibrations: true, animationsReduites: false };
export const CLE_PREFERENCES = 'retours.preferences';

/** Sons originaux synthétisés par `scripts/fabriquer-sons.py` (licence : projet, pas de droits tiers). 133 Ko au total. */
const SONS: Record<Moment, number> = {
  success: require('../../assets/sounds/succes.wav'),
  error: require('../../assets/sounds/echec.wav'),
  select: require('../../assets/sounds/tap.wav'),
  reward: require('../../assets/sounds/recompense.wav'),
  celebrate: require('../../assets/sounds/celebration.wav'),
};

let preferences: Preferences = { ...PREFERENCES_PAR_DEFAUT };
const ecouteurs = new Set<() => void>();
const lecteurs = new Map<Moment, AudioPlayer>();
let modeAudioPose = false;
let charge = false;

export const lirePreferences = (): Preferences => preferences;

export function abonnerPreferences(fonction: () => void): () => void {
  ecouteurs.add(fonction);
  return () => ecouteurs.delete(fonction);
}

const notifier = () => ecouteurs.forEach((f) => f());

/** Lit les préférences mémorisées (aussi en invité). Valeurs absentes ou illisibles : valeurs par défaut. */
export async function chargerPreferences(): Promise<Preferences> {
  try {
    const brut = await AsyncStorage.getItem(CLE_PREFERENCES);
    if (brut) {
      const lu = JSON.parse(brut) as Partial<Preferences>;
      preferences = {
        sons: typeof lu.sons === 'boolean' ? lu.sons : true,
        vibrations: typeof lu.vibrations === 'boolean' ? lu.vibrations : true,
        animationsReduites: typeof lu.animationsReduites === 'boolean' ? lu.animationsReduites : false,
      };
    }
  } catch {
    // Stockage indisponible : on garde les valeurs par défaut.
  }
  charge = true;
  notifier();
  return preferences;
}

const NOM_REGLAGE = { sons: 'sounds', vibrations: 'haptics', animationsReduites: 'reduced_motion' } as const;

const proprietes = () => ({ sound_on: preferences.sons, haptics_on: preferences.vibrations, reduced_motion: preferences.animationsReduites });

/** Change un réglage : effet immédiat, mémorisé, événement d'analytics. */
export async function definirPreference<C extends keyof Preferences>(cle: C, valeur: Preferences[C]): Promise<void> {
  preferences = { ...preferences, [cle]: valeur };
  notifier();
  suivre('feedback_setting_changed', { setting: NOM_REGLAGE[cle], value: valeur, ...proprietes() });
  try {
    await AsyncStorage.setItem(CLE_PREFERENCES, JSON.stringify(preferences));
  } catch {
    // Le réglage reste actif pour cette session.
  }
}

async function poserModeAudio() {
  if (modeAudioPose) return;
  modeAudioPose = true;
  try {
    // Pas de son en mode silencieux (iOS), et on se mélange à la musique de l'élève sans la couper.
    await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false });
  } catch {
    modeAudioPose = false;
  }
}

function lecteur(moment: Moment): AudioPlayer | null {
  let l = lecteurs.get(moment);
  if (!l) {
    try {
      l = createAudioPlayer(SONS[moment]);
      lecteurs.set(moment, l);
    } catch {
      return null;
    }
  }
  return l;
}

/** Précharge les 5 sons au démarrage : aucun décalage audible entre l'appui et le son. Ne lève jamais. */
export async function precharger(): Promise<void> {
  if (!charge) await chargerPreferences();
  await poserModeAudio();
  moments.forEach(lecteur);
}

async function vibrer(moment: Moment) {
  try {
    if (moment === 'error') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    else if (moment === 'select') await Haptics.selectionAsync();
    else if (moment === 'reward') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Téléphone sans moteur haptique fin : vibration courte de repli (≤ 30 ms), jamais sur le web.
    if (Platform.OS === 'android') Vibration.vibrate(25);
  }
}

async function sonner(moment: Moment) {
  await poserModeAudio();
  const l = lecteur(moment);
  if (!l) return;
  try {
    await l.seekTo(0);
    l.play();
  } catch {
    // Un son manqué ne doit jamais casser l'écran.
  }
}

/**
 * Joue le retour d'un moment clé selon les préférences (son et vibration séparés). Ne lève jamais.
 * Le visuel (animation) est géré par les composants via `useFeedback().reduit`.
 */
export async function jouerMoment(moment: Moment): Promise<void> {
  const { sons, vibrations } = preferences;
  if (moment === 'celebrate') suivre('celebration_seen', proprietes());
  await Promise.all([vibrations ? vibrer(moment) : null, sons ? sonner(moment) : null]);
}

/** Pour les tests uniquement. */
export function reinitialiserRetoursPourTests() {
  preferences = { ...PREFERENCES_PAR_DEFAUT };
  ecouteurs.clear();
  lecteurs.clear();
  modeAudioPose = false;
  charge = false;
}
