import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';

import { jourLocal } from './mission';

export type TypeActivite = 'cours' | 'lecon' | 'quiz' | 'exercice' | 'annale' | 'mission';

export type SessionActivite = {
  type: TypeActivite;
  matiere?: string;
  titre?: string;
  secondes: number;
  quand: string; // ISO
};

export type ActiviteJour = {
  jour: string; // AAAA-MM-JJ
  secondes: number;
  parType: Record<TypeActivite, number>;
  parMatiere: Record<string, number>;
  sessions: SessionActivite[];
};

export const CLE_ACTIVITES_JOURS = 'activites.jours';

/** Lit toutes les activités enregistrées par jour. */
export async function lireActivitesJours(): Promise<Record<string, ActiviteJour>> {
  try {
    const brut = await AsyncStorage.getItem(CLE_ACTIVITES_JOURS);
    return brut ? (JSON.parse(brut) as Record<string, ActiviteJour>) : {};
  } catch {
    return {};
  }
}

/** Enregistre le temps passé sur une activité éducative. */
export async function enregistrerTempsActivite(p: {
  type: TypeActivite;
  dureeS: number;
  matiere?: string;
  titre?: string;
  date?: Date;
}): Promise<void> {
  const dureeS = Math.max(0, Math.round(p.dureeS));
  // Ignorer les durées de moins de 3 secondes (ouverture accidentelle / clic immédiat)
  if (dureeS < 3) return;

  const date = p.date ?? new Date();
  const jour = jourLocal(date);
  const matierePropre = p.matiere ? p.matiere.trim() : 'Général';

  try {
    const tous = await lireActivitesJours();
    const existant = tous[jour] ?? {
      jour,
      secondes: 0,
      parType: { cours: 0, lecon: 0, quiz: 0, exercice: 0, annale: 0, mission: 0 },
      parMatiere: {},
      sessions: [],
    };

    existant.secondes += dureeS;
    existant.parType[p.type] = (existant.parType[p.type] ?? 0) + dureeS;
    if (matierePropre) {
      existant.parMatiere[matierePropre] = (existant.parMatiere[matierePropre] ?? 0) + dureeS;
    }

    existant.sessions.push({
      type: p.type,
      matiere: matierePropre,
      titre: p.titre,
      secondes: dureeS,
      quand: date.toISOString(),
    });

    // On ne garde que les 100 dernières sessions par jour pour éviter l'encombrement
    if (existant.sessions.length > 100) {
      existant.sessions = existant.sessions.slice(-100);
    }

    tous[jour] = existant;
    await AsyncStorage.setItem(CLE_ACTIVITES_JOURS, JSON.stringify(tous));
  } catch (err) {
    console.warn('Impossible d’enregistrer le temps d’activité locale.', err);
  }
}

/**
 * Hook de chronomètre actif résistant à l'arrière-plan (`AppState` + horodatage absolu `Date.now()`).
 * Peut fonctionner en montant (chrono libre) ou en compte à rebours (si `dureeInitialeS` est fournie).
 */
export function useChrono(options: {
  dureeInitialeS?: number; // si présent : compte à rebours ; sinon chrono montant
  actif?: boolean;
  onFin?: () => void;
  onAlerte?: (secondesRestantes: number) => void;
} = {}) {
  const { dureeInitialeS, actif = true, onFin, onAlerte } = options;

  // Temps cumulé écoulé en secondes
  const [tempsEcouleS, setTempsEcouleS] = useState(0);

  const debutRef = useRef<number | null>(null);
  const pauseRef = useRef<number | null>(null);
  const cumulPauseRef = useRef(0);
  const finAppeleeRef = useRef(false);
  const alertesPasseesRef = useRef<Set<number>>(new Set());

  // Réinitialiser / Démarrer
  const demarrer = useCallback(() => {
    debutRef.current = Date.now();
    pauseRef.current = null;
    cumulPauseRef.current = 0;
    finAppeleeRef.current = false;
    alertesPasseesRef.current.clear();
    setTempsEcouleS(0);
  }, []);

  useEffect(() => {
    if (actif && debutRef.current === null) {
      demarrer();
    }
  }, [actif, demarrer]);

  // Écoute de l'AppState (résistance au passage en arrière-plan)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (prochain: AppStateStatus) => {
      if (!actif || debutRef.current === null) return;

      if (prochain.match(/inactive|background/)) {
        // L'application passe en arrière-plan : on mémorise le moment de pause
        pauseRef.current = Date.now();
      } else if (prochain === 'active' && pauseRef.current !== null) {
        // Retour au premier plan : on ajuste ou le timer continue selon le temps réel
        pauseRef.current = null;
        // Calculer instantanément la nouvelle valeur
        const maintenant = Date.now();
        const total = Math.floor((maintenant - debutRef.current) / 1000);
        setTempsEcouleS(total);
      }
    });

    return () => {
      sub.remove();
    };
  }, [actif]);

  // Intervalle de tick à l'écran
  useEffect(() => {
    if (!actif) return;

    const intervalle = setInterval(() => {
      if (debutRef.current === null || pauseRef.current !== null) return;

      const maintenant = Date.now();
      const total = Math.floor((maintenant - debutRef.current) / 1000);
      setTempsEcouleS(total);

      if (dureeInitialeS !== undefined) {
        const restant = Math.max(0, dureeInitialeS - total);

        // Alertes (10 min, 5 min, 1 min)
        const seuils = [600, 300, 60];
        for (const s of seuils) {
          if (restant <= s && restant > s - 2 && !alertesPasseesRef.current.has(s)) {
            alertesPasseesRef.current.add(s);
            onAlerte?.(restant);
          }
        }

        if (restant <= 0 && !finAppeleeRef.current) {
          finAppeleeRef.current = true;
          onFin?.();
        }
      }
    }, 1000);

    return () => clearInterval(intervalle);
  }, [actif, dureeInitialeS, onAlerte, onFin]);

  const tempsRestantS = dureeInitialeS !== undefined ? Math.max(0, dureeInitialeS - tempsEcouleS) : null;

  return {
    tempsEcouleS,
    tempsRestantS,
    demarrer,
  };
}
