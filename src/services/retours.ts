import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';

import { retours } from '@/theme/theme';

import { suivre } from './analytics';
import { signalerModification } from './reglagesLocaux';

/** Les moments clés de l'app (carte `retours` du thème : moment -> son + haptique). Les écrans n'appellent jamais un son ou une vibration en direct : ils passent par `useFeedback`. */
export type Moment = keyof typeof retours;
export const moments = Object.keys(retours) as Moment[];

/** Volume des sons (H2b) : « faible » joue à moitié du volume du téléphone. */
export type Volume = 'faible' | 'normal';
export type Preferences = { sons: boolean; vibrations: boolean; animationsReduites: boolean; volume: Volume };
export const PREFERENCES_PAR_DEFAUT: Preferences = { sons: true, vibrations: true, animationsReduites: false, volume: 'normal' };
export const NIVEAU_VOLUME: Record<Volume, number> = { faible: 0.5, normal: 1 };
const estVolume = (v: unknown): v is Volume => v === 'faible' || v === 'normal';
export const CLE_PREFERENCES = 'retours.preferences';

type NomSon = NonNullable<(typeof retours)[Moment]['son']>;

/** Sons originaux CC0 (assets/sounds, 56 Ko au total). `require` doit être statique pour Metro. */
const SONS: Record<NomSon, number> = {
  clic: require('../../assets/sounds/clic.mp3'),
  'bonne-reponse': require('../../assets/sounds/bonne-reponse.mp3'),
  erreur: require('../../assets/sounds/erreur.mp3'),
  validation: require('../../assets/sounds/validation.mp3'),
  'correction-prete': require('../../assets/sounds/correction-prete.mp3'),
  'fin-mission': require('../../assets/sounds/fin-mission.mp3'),
  serie: require('../../assets/sounds/serie.mp3'),
  recompense: require('../../assets/sounds/recompense.mp3'),
  'paiement-reussi': require('../../assets/sounds/paiement-reussi.mp3'),
  'alerte-chrono': require('../../assets/sounds/alerte-chrono.mp3'),
  'fin-epreuve': require('../../assets/sounds/fin-epreuve.mp3'),
};

let preferences: Preferences = { ...PREFERENCES_PAR_DEFAUT };
const ecouteurs = new Set<() => void>();
const lecteurs = new Map<NomSon, AudioPlayer>();
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
        volume: estVolume(lu.volume) ? lu.volume : 'normal',
      };
    }
  } catch {
    // Stockage indisponible : on garde les valeurs par défaut.
  }
  charge = true;
  notifier();
  return preferences;
}

const NOM_REGLAGE = { sons: 'sounds', vibrations: 'haptics', animationsReduites: 'reduced_motion', volume: 'volume' } as const;

const proprietes = () => ({ sound_on: preferences.sons, haptics_on: preferences.vibrations, reduced_motion: preferences.animationsReduites });

/** Change un réglage : effet immédiat, mémorisé, événement d'analytics. */
export async function definirPreference<C extends keyof Preferences>(cle: C, valeur: Preferences[C]): Promise<void> {
  preferences = { ...preferences, [cle]: valeur };
  notifier();
  suivre('feedback_setting_changed', { setting: NOM_REGLAGE[cle], value: valeur, ...proprietes() });
  await memoriser();
  await signalerModification();
}

async function memoriser() {
  try {
    await AsyncStorage.setItem(CLE_PREFERENCES, JSON.stringify(preferences));
  } catch {
    // Le réglage reste actif pour cette session.
  }
}

/** Réglages venus du compte (synchronisation) : appliqués et mémorisés, sans événement d'analytics. */
export async function appliquerPreferences(p: Partial<Preferences>): Promise<void> {
  preferences = {
    sons: typeof p.sons === 'boolean' ? p.sons : preferences.sons,
    vibrations: typeof p.vibrations === 'boolean' ? p.vibrations : preferences.vibrations,
    animationsReduites: typeof p.animationsReduites === 'boolean' ? p.animationsReduites : preferences.animationsReduites,
    volume: estVolume(p.volume) ? p.volume : preferences.volume,
  };
  notifier();
  await memoriser();
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

function lecteur(son: NomSon): AudioPlayer | null {
  let l = lecteurs.get(son);
  if (!l) {
    try {
      l = createAudioPlayer(SONS[son]);
      lecteurs.set(son, l);
    } catch {
      return null;
    }
  }
  return l;
}

/** Précharge les 11 sons au démarrage : aucun décalage audible entre l'appui et le son. Ne lève jamais. */
export async function precharger(): Promise<void> {
  if (!charge) await chargerPreferences();
  await poserModeAudio();
  (Object.keys(SONS) as NomSon[]).forEach(lecteur);
}

async function vibrer(moment: Moment) {
  try {
    const h = retours[moment].haptique as string;
    if (h === 'selection') await Haptics.selectionAsync();
    else if (h === 'light') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (h === 'warning') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else if (h === 'error') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    else await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Téléphone sans moteur haptique fin : vibration courte de repli (≤ 30 ms), jamais sur le web.
    if (Platform.OS === 'android') Vibration.vibrate(25);
  }
}

async function sonner(son: NomSon) {
  await poserModeAudio();
  const l = lecteur(son);
  if (!l) return;
  try {
    l.volume = NIVEAU_VOLUME[preferences.volume];
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
export async function jouerMoment(moment: Moment, options: { apercu?: boolean } = {}): Promise<void> {
  const { sons, vibrations } = preferences;
  const carte = retours[moment];
  if (moment === 'celebrate') suivre('celebration_seen', proprietes());
  // Le son de sélection est désactivé par défaut (haptique seule) ; l'aperçu des réglages le fait entendre.
  const sonAutorise = carte.son && (options.apercu || !('sonParDefaut' in carte) || carte.sonParDefaut);
  await Promise.all([vibrations ? vibrer(moment) : null, sons && sonAutorise ? sonner(carte.son as NomSon) : null]);
}

/** Pour les tests uniquement. */
export function reinitialiserRetoursPourTests() {
  preferences = { ...PREFERENCES_PAR_DEFAUT };
  ecouteurs.clear();
  lecteurs.clear();
  modeAudioPose = false;
  charge = false;
}
