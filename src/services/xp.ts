import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { suivre } from './analytics';

export type SourceXp = 'quiz' | 'daily_mission' | 'course' | 'exercise' | 'exam' | 'feed_post' | 'feed_comment';

export interface PalierNiveau {
  niveau: number;
  nomCleI18n: string;
  seuilMin: number;
  seuilSuivant: number | null;
  couleur: string; // Token ou couleur de palier
}

/**
 * 10 Paliers de niveaux simples et transparents (M4-07).
 * Les couleurs suivent la charte Elearn Prépa :
 * - Niveau 1 : Neutre / Débutant
 * - Niveaux 2 à 4 : Émeraude (marque)
 * - Niveaux 5 à 7 : Bleu (info / maîtrise)
 * - Niveaux 8 à 10 : Or Soleil (excellence / prestige)
 */
export const PALIERS_NIVEAU: readonly PalierNiveau[] = [
  { niveau: 1, nomCleI18n: 'xp.palier1', seuilMin: 0, seuilSuivant: 100, couleur: '#B69CFF' },
  { niveau: 2, nomCleI18n: 'xp.palier2', seuilMin: 100, seuilSuivant: 250, couleur: '#10B981' },
  { niveau: 3, nomCleI18n: 'xp.palier3', seuilMin: 250, seuilSuivant: 500, couleur: '#10B981' },
  { niveau: 4, nomCleI18n: 'xp.palier4', seuilMin: 500, seuilSuivant: 1000, couleur: '#059669' },
  { niveau: 5, nomCleI18n: 'xp.palier5', seuilMin: 1000, seuilSuivant: 2000, couleur: '#5B9BFF' },
  { niveau: 6, nomCleI18n: 'xp.palier6', seuilMin: 2000, seuilSuivant: 3500, couleur: '#5B9BFF' },
  { niveau: 7, nomCleI18n: 'xp.palier7', seuilMin: 3500, seuilSuivant: 5500, couleur: '#1A75FF' },
  { niveau: 8, nomCleI18n: 'xp.palier8', seuilMin: 5500, seuilSuivant: 8000, couleur: '#FF9A3D' },
  { niveau: 9, nomCleI18n: 'xp.palier9', seuilMin: 8000, seuilSuivant: 12000, couleur: '#FFD83D' },
  { niveau: 10, nomCleI18n: 'xp.palier10', seuilMin: 12000, seuilSuivant: null, couleur: '#FFD83D' },
] as const;

/** Barème public d'attribution de l'effort (M4-07). */
export const BAREME_XP = [
  { source: 'quiz', gain: 10, cleI18n: 'xp.baremeQuiz' },
  { source: 'daily_mission', gain: 50, cleI18n: 'xp.baremeMission' },
  { source: 'course', gain: 20, cleI18n: 'xp.baremeCourse' },
  { source: 'exercise', gain: 15, cleI18n: 'xp.baremeExercise' },
  { source: 'exam', gain: 100, cleI18n: 'xp.baremeExam' },
  { source: 'feed_post', gain: 5, cleI18n: 'xp.baremeFeedPost' },
  { source: 'feed_comment', gain: 10, cleI18n: 'xp.baremeFeedComment' },
] as const;

export interface InfoNiveau {
  niveau: number;
  nomCleI18n: string;
  totalXp: number;
  seuilMin: number;
  seuilSuivant: number | null;
  xpActuelDansNiveau: number;
  xpRequisPourSuivant: number;
  ratioProgression: number; // de 0 à 1 (pourcentage pour la jauge)
  couleur: string;
}

/** Calcule le niveau et la progression circulaire à partir du total XP. */
export function calculerNiveau(totalXp: number): InfoNiveau {
  const xp = Math.max(0, Math.floor(totalXp || 0));

  let palierActuel: PalierNiveau = PALIERS_NIVEAU[0];
  for (let i = PALIERS_NIVEAU.length - 1; i >= 0; i--) {
    if (xp >= PALIERS_NIVEAU[i].seuilMin) {
      palierActuel = PALIERS_NIVEAU[i];
      break;
    }
  }

  if (palierActuel.seuilSuivant === null) {
    // Palier max atteint (Légende)
    return {
      niveau: palierActuel.niveau,
      nomCleI18n: palierActuel.nomCleI18n,
      totalXp: xp,
      seuilMin: palierActuel.seuilMin,
      seuilSuivant: null,
      xpActuelDansNiveau: xp - palierActuel.seuilMin,
      xpRequisPourSuivant: 0,
      ratioProgression: 1,
      couleur: palierActuel.couleur,
    };
  }

  const tranche = palierActuel.seuilSuivant - palierActuel.seuilMin;
  const acquis = xp - palierActuel.seuilMin;
  const ratio = Math.min(1, Math.max(0, tranche > 0 ? acquis / tranche : 0));

  return {
    niveau: palierActuel.niveau,
    nomCleI18n: palierActuel.nomCleI18n,
    totalXp: xp,
    seuilMin: palierActuel.seuilMin,
    seuilSuivant: palierActuel.seuilSuivant,
    xpActuelDansNiveau: acquis,
    xpRequisPourSuivant: palierActuel.seuilSuivant - xp,
    ratioProgression: ratio,
    couleur: palierActuel.couleur,
  };
}

export const CLE_XP_LOCAL = 'xp.totalLocal';

type Client = Pick<SupabaseClient, 'from'>;

/**
 * Lit les XP de l'élève connecté dans `public.user_xp`.
 * Les XP de l'ancienne application sont ainsi repris et conservés.
 * Replie sur le cache local en mode hors ligne ou invité.
 */
export async function lireUserXp(client?: Client | null, userId?: string | null): Promise<number> {
  if (client && userId) {
    try {
      const { data, error } = await client.from('user_xp').select('total_xp').eq('userid', userId).maybeSingle();
      if (!error && data && typeof (data as { total_xp: number }).total_xp === 'number') {
        const distant = (data as { total_xp: number }).total_xp;
        await AsyncStorage.setItem(CLE_XP_LOCAL, String(distant)).catch(() => {});
        return distant;
      }
    } catch {
      // Repli sur le stockage local ci-dessous
    }
  }

  // Repli sur le cache local (invités, hors ligne)
  try {
    const local = await AsyncStorage.getItem(CLE_XP_LOCAL);
    return local ? Math.max(0, parseInt(local, 10) || 0) : 0;
  } catch {
    return 0;
  }
}

/**
 * Crédite des points d'XP :
 * - Persiste localement pour affichage et calcul instantané.
 * - Écrit dans `public.xp_history` sur Supabase si connecté (le trigger Postgres met à jour `user_xp`).
 * - Trace l'événement PostHog `xp_earned`.
 */
export async function crediterXp(
  client?: Client | null,
  userId?: string | null,
  gain = 0,
  source: SourceXp = 'quiz',
  sourceId?: string,
): Promise<number> {
  if (gain <= 0) {
    return lireUserXp(client, userId);
  }

  const actuel = await lireUserXp(client, userId);
  const nouveauTotal = actuel + gain;
  await AsyncStorage.setItem(CLE_XP_LOCAL, String(nouveauTotal)).catch(() => {});

  if (client && typeof client.from === 'function' && userId) {
    try {
      await client.from('xp_history').insert({
        userid: userId,
        xp_gained: gain,
        source_type: 'quiz', // Le trigger serveur update_user_xp écoute source_type = 'quiz'
        source_id: sourceId ?? source,
      });
    } catch (err) {
      console.warn('Impossible d’enregistrer le gain d’XP sur Supabase.', err);
    }
  }

  notifierXpGagne(gain, nouveauTotal, source);
  return nouveauTotal;
}

export type InfoGainXp = {
  gain: number;
  total: number;
  source: SourceXp | string;
};

type AuditeurGainXp = (info: InfoGainXp) => void;
const auditeursGainXp: Set<AuditeurGainXp> = new Set();

/** Permet à l'application d'écouter les gains d'XP en temps réel (ex: pour afficher un toast). */
export function ecouterGainXp(auditeur: AuditeurGainXp): () => void {
  auditeursGainXp.add(auditeur);
  return () => {
    auditeursGainXp.delete(auditeur);
  };
}

/** Émet l'événement de gain XP à tous les auditeurs actifs. */
export function emettreGainXp(info: InfoGainXp): void {
  for (const auditeur of auditeursGainXp) {
    try {
      auditeur(info);
    } catch (err) {
      console.warn('Erreur dans un auditeur de gain XP.', err);
    }
  }
}

/**
 * Notifie l'événement PostHog après un gain d'XP et déclenche les auditeurs d'UI.
 */
export function notifierXpGagne(gain: number, totalApresGain: number, source: SourceXp | string): void {
  const info = calculerNiveau(totalApresGain);
  suivre('xp_earned', {
    gain,
    total: totalApresGain,
    source,
    niveau: info.niveau,
  });
  emettreGainXp({ gain, total: totalApresGain, source });
}

/** Déclenche une notification push locale immédiate sur le téléphone lors d'un passage de niveau. */
export async function notifierNiveauDebloqueNotification(niveau: number, titre: string, corps: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = await import('expo-notifications');
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: titre,
        body: corps,
        data: { screen: '/xp' },
      },
      trigger: null,
    });
  } catch {
    // Ne bloque jamais
  }
}
