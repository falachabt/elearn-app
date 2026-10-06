import type { SupabaseClient } from '@supabase/supabase-js';

import { envoyerPassages, jourLocal, lirePassagesLocaux } from './mission';

type Client = Pick<SupabaseClient, 'from'>;

/** Ligne de `mission_runs` utile à la progression. */
export type Passage = { jour: string; dureeS: number | null; questions: number; chapitres: { matiere: string; bonnes: number; total: number }[] };

/** Une colonne du graphique « Cette semaine » : lundi à dimanche. */
export type JourSemaine = { jour: string; minutes: number };

export type NiveauMatiere = { matiere: string; pourcentage: number; questions: number };

export type Progression = { semaine: JourSemaine[]; minutesSemaine: number; questionsSemaine: number; matieres: NiveauMatiere[] };

/** Jours pris en compte pour le niveau par matière. */
export const FENETRE_NIVEAU_JOURS = 30;

/** Lundi de la semaine de `date`, au format jour local AAAA-MM-JJ. */
export function lundiDe(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Calcule la semaine (minutes de mission par jour, lundi à dimanche) et le niveau par matière. Fonction pure. */
export function calculerProgression(passages: readonly Passage[], maintenant = new Date()): Progression {
  const lundi = lundiDe(maintenant);
  const semaine: JourSemaine[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lundi);
    d.setDate(lundi.getDate() + i);
    const jour = jourLocal(d);
    const secondes = passages.filter((p) => p.jour === jour).reduce((n, p) => n + (p.dureeS ?? 0), 0);
    return { jour, minutes: Math.round(secondes / 60) };
  });
  const debut = new Date(maintenant);
  debut.setDate(debut.getDate() - FENETRE_NIVEAU_JOURS);
  const limite = jourLocal(debut);
  const parMatiere = new Map<string, { bonnes: number; total: number }>();
  for (const p of passages) {
    if (p.jour < limite) continue;
    for (const c of p.chapitres) {
      const nom = c.matiere.trim();
      if (!nom || c.total <= 0) continue;
      const m = parMatiere.get(nom) ?? { bonnes: 0, total: 0 };
      m.bonnes += c.bonnes;
      m.total += c.total;
      parMatiere.set(nom, m);
    }
  }
  const matieres = [...parMatiere.entries()]
    .map(([matiere, m]) => ({ matiere, pourcentage: Math.round((m.bonnes / m.total) * 100), questions: m.total }))
    .sort((a, b) => b.questions - a.questions || a.matiere.localeCompare(b.matiere));
  const jours = new Set(semaine.map((j) => j.jour));
  const questionsSemaine = passages.filter((p) => jours.has(p.jour)).reduce((n, p) => n + p.questions, 0);
  return { semaine, minutesSemaine: semaine.reduce((n, j) => n + j.minutes, 0), questionsSemaine, matieres };
}

type LigneRun = { day: string; duration_s: number | null; total: number; details: { chapitres?: { libelleMatiere?: string; bonnes?: number; total?: number }[] } | null };

/** Missions faites des 30 derniers jours (et de la semaine en cours), lues sur le compte (invité compris). */
export async function lirePassages(client: Client, maintenant = new Date()): Promise<Passage[]> {
  const debut = new Date(Math.min(lundiDe(maintenant).getTime(), maintenant.getTime() - FENETRE_NIVEAU_JOURS * 86_400_000));
  const limite = jourLocal(debut);
  // Les missions terminées hors ligne partent maintenant (sans attendre ni bloquer si le réseau manque).
  await envoyerPassages(client).catch(() => {});
  const locaux = (await lirePassagesLocaux()).filter((p) => p.day >= limite);
  const depuisLigne = (l: LigneRun): Passage => ({
    jour: l.day,
    dureeS: l.duration_s,
    questions: l.total,
    // Les missions jouées avant le 01/10 n'ont pas le nom de la matière : elles comptent dans le temps, pas dans le niveau.
    chapitres: (l.details?.chapitres ?? []).map((c) => ({ matiere: c.libelleMatiere ?? '', bonnes: c.bonnes ?? 0, total: c.total ?? 0 })),
  });
  const { data, error } = await client.from('mission_runs').select('day, duration_s, total, details').gte('day', limite).order('day').then(
    (r) => r,
    (e: unknown) => ({ data: null, error: e ?? new Error('réseau') }),
  );
  if (error) {
    // Hors ligne : la progression se calcule sur les missions gardées sur le téléphone, plutôt que de rester vide.
    if (locaux.length) return locaux.map((p) => depuisLigne({ day: p.day, duration_s: p.duration_s, total: p.total, details: p.details as LigneRun['details'] }));
    throw error;
  }
  const serveur = ((data ?? []) as LigneRun[]).map(depuisLigne);
  // Seules les missions pas encore reçues par le serveur s'ajoutent : jamais de doublon avec celles qu'il renvoie.
  const enAttente = locaux.filter((p) => !p.envoye).map((p) => depuisLigne({ day: p.day, duration_s: p.duration_s, total: p.total, details: p.details as LigneRun['details'] }));
  return [...serveur, ...enAttente];
}
