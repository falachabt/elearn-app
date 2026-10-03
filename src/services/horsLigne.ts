import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Paths } from 'expo-file-system';

import { i18n } from '@/i18n';

import { prechargerDocument } from './documents';
import { depenser, lireOuverts } from './credits';
import { lireEntrainement, lireExercice, lireQuizLibre } from './entrainement';
import { lireDossiers, lireDocuments } from './annales';
import { prechargerMission } from './mission';
import { lireAcces } from './pass';
import { lireProfil, type Profil } from './profil';
import { lireFiche, lireLecon, lireLecons, lireQuizLecon, lireCours } from './reviser';
import { lireRythme } from './rythme';
import { getSupabase } from './supabase';

export const CLE_MODE_HORS_LIGNE = 'horsLigne.mode';
export const CLE_INVITATION_HORS_LIGNE = 'horsLigne.invitationVue';
export const CLE_ETAT_HORS_LIGNE = 'horsLigne.telechargement';

export const CATEGORIES_HORS_LIGNE = ['missions', 'cours', 'quiz', 'exercices', 'pdf'] as const;
export type CategorieHorsLigne = (typeof CATEGORIES_HORS_LIGNE)[number];
type Tache = {
  id: string;
  categorie: CategorieHorsLigne;
  statut: 'a-faire' | 'faite' | 'echec';
  jour?: string;
  cours?: number;
  lecon?: number;
  quiz?: string;
  exercice?: string;
  corrige?: boolean;
  document?: { id: string; titre: string };
  niveau?: string;
  pays?: string;
  concours?: string | null;
  taille?: number;
  tailleOctets?: number;
  erreur?: string;
};

export type ProgressionCategorie = { total: number; faites: number; echecs: number };
export type EstimationCategorie = { total: number; octets: number };
export type EstimationTelechargement = Pick<EtatHorsLigne, 'profil' | 'taches' | 'progression' | 'estimationOctets' | 'espaceDisponible'> & {
  estimationCategories: Record<CategorieHorsLigne, EstimationCategorie>;
};
export type EtatHorsLigne = {
  statut: 'pret' | 'telechargement' | 'termine' | 'partiel';
  profil: Pick<Profil, 'niveau' | 'pays' | 'concours'>;
  taches: Tache[];
  progression: Record<CategorieHorsLigne, ProgressionCategorie>;
  estimationOctets: number;
  estimationCategories?: Record<CategorieHorsLigne, EstimationCategorie>;
  espaceDisponible: number;
  notification?: 'autorisee' | 'refusee' | 'echec';
  actualiseLe: string;
};

const ecouteurs = new Set<(etat: EtatHorsLigne | null) => void>();
let execution: Promise<void> | null = null;

function notifier(etat: EtatHorsLigne | null) {
  for (const ecouteur of ecouteurs) ecouteur(etat);
}

export function ecouterHorsLigne(ecouteur: (etat: EtatHorsLigne | null) => void): () => void {
  ecouteurs.add(ecouteur);
  return () => ecouteurs.delete(ecouteur);
}

export async function lireEtatHorsLigne(): Promise<EtatHorsLigne | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE_ETAT_HORS_LIGNE);
    return brut ? (JSON.parse(brut) as EtatHorsLigne) : null;
  } catch {
    return null;
  }
}

async function enregistrer(etat: EtatHorsLigne): Promise<void> {
  etat.actualiseLe = new Date().toISOString();
  await AsyncStorage.setItem(CLE_ETAT_HORS_LIGNE, JSON.stringify(etat));
  notifier(etat);
}

export async function aVuInvitationHorsLigne(): Promise<boolean> {
  return (await AsyncStorage.getItem(CLE_INVITATION_HORS_LIGNE)) === '1';
}

export async function noterInvitationHorsLigneVue(): Promise<void> {
  await AsyncStorage.setItem(CLE_INVITATION_HORS_LIGNE, '1');
}

export async function modeHorsLigneActif(): Promise<boolean> {
  return (await AsyncStorage.getItem(CLE_MODE_HORS_LIGNE)) === '1';
}

function ajouterTache(taches: Tache[], categorie: CategorieHorsLigne, id: string, details: Omit<Tache, 'id' | 'categorie' | 'statut'> = {}) {
  taches.push({ id, categorie, statut: 'a-faire', ...details });
}

function progression(taches: Tache[]): EtatHorsLigne['progression'] {
  return Object.fromEntries(CATEGORIES_HORS_LIGNE.map((categorie) => {
    const liste = taches.filter((t) => t.categorie === categorie);
    return [categorie, {
      total: liste.length,
      faites: liste.filter((t) => t.statut === 'faite').length,
      echecs: liste.filter((t) => t.statut === 'echec').length,
    }];
  })) as EtatHorsLigne['progression'];
}

const OCTETS_PAR_TACHE: Record<CategorieHorsLigne, number> = {
  missions: 32 * 1024,
  cours: 96 * 1024,
  quiz: 48 * 1024,
  exercices: 40 * 1024,
  pdf: 1_500 * 1024,
};

function tailleTache(tache: Tache): number {
  return tache.tailleOctets ?? OCTETS_PAR_TACHE[tache.categorie];
}

function estimerCategories(taches: Tache[]): Record<CategorieHorsLigne, EstimationCategorie> {
  return Object.fromEntries(CATEGORIES_HORS_LIGNE.map((categorie) => {
    const ressources = taches.filter((tache) => tache.categorie === categorie);
    return [categorie, {
      total: ressources.length,
      octets: ressources.reduce((total, tache) => total + tailleTache(tache), 0),
    }];
  })) as Record<CategorieHorsLigne, EstimationCategorie>;
}

function octetsEstimes(taches: Tache[]): number {
  return taches.reduce((total, tache) => total + tailleTache(tache), 0);
}

function documentsEstimes(taches: Tache[], documents: { id: string; titre: string; correctionId: string | null; tailleOctets?: number }[]): void {
  const tailles = new Map(documents.flatMap((d) => d.tailleOctets ? [[d.id, d.tailleOctets] as const] : []));
  for (const tache of taches) {
    if (tache.categorie === 'pdf' && tache.document?.id) tache.tailleOctets = tailles.get(tache.document.id);
  }
}

async function lireDocumentsProgramme(client: ReturnType<typeof getSupabase>, profil: Profil): Promise<{ id: string; titre: string; correctionId: string | null }[]> {
  const visiter = async (parent: string | null): Promise<{ id: string; titre: string; correctionId: string | null; tailleOctets?: number }[]> => {
    const dossiers = await lireDossiers(client, { niveau: profil.niveau ?? '3e', pays: profil.pays ?? 'CM', parent });
    const contenus = await Promise.all(dossiers.map(async (dossier) => {
      const [fichiers, enfants] = await Promise.all([
        lireDocuments(client, dossier.id),
        dossier.sousDossiers > 0 ? visiter(dossier.id) : Promise.resolve([]),
      ]);
      return [
        ...fichiers.map((f) => ({ id: f.id, titre: f.nom, correctionId: f.correctionId, tailleOctets: f.tailleOctets })),
        ...enfants,
      ];
    }));
    return contenus.flat();
  };
  return visiter(null);
}

async function lireRefsOuvertes(client: ReturnType<typeof getSupabase>, action: 'exercise_solution' | 'document_pdf', refs: string[]): Promise<Set<string>> {
  const lots: string[][] = [];
  for (let i = 0; i < refs.length; i += 200) lots.push(refs.slice(i, i + 200));
  const ouverts = await Promise.all(lots.map((lot) => lireOuverts(client, action, lot)));
  return new Set(ouverts.flatMap((lot) => [...lot]));
}

export async function estimerTelechargement(): Promise<EstimationTelechargement> {
  const client = getSupabase();
  const profil = await lireProfil();
  if (!profil) throw new Error('profil de formation introuvable');
  const programme = { niveau: profil.niveau ?? '3e', pays: profil.pays ?? 'CM', concours: profil.concours?.id ?? null };
  const taches: Tache[] = [];
  const [acces, cours, rythme] = await Promise.all([lireAcces(client), lireCours(client, programme), lireRythme()]);
  const passActif = !!acces && new Date(acces.fin).getTime() > Date.now();
  const aujourdHui = new Date();
  for (let i = 0; i < 7; i++) {
    const jour = aujourdhuiPlus(
      `${aujourdHui.getFullYear()}-${String(aujourdHui.getMonth() + 1).padStart(2, '0')}-${String(aujourdHui.getDate()).padStart(2, '0')}`,
      i,
    );
    ajouterTache(taches, 'missions', jour, { jour, niveau: programme.niveau, pays: programme.pays, concours: programme.concours, taille: rythme ?? undefined });
  }

  const [leconsParCours, documents] = await Promise.all([
    Promise.all(cours.map(async (c) => ({ cours: c.id, lecons: await lireLecons(client, c.id), activites: await lireEntrainement(client, c.id) }))),
    profil.type === 'eleve' ? lireDocumentsProgramme(client, profil) : Promise.resolve([]),
  ]);
  const exercices = leconsParCours.flatMap((c) => c.activites.exercices.map((x) => x.id));
  const refsDocuments = documents.flatMap((d) => [d.id, ...(d.correctionId ? [d.correctionId] : [])]);
  const [exercicesOuverts, refsOuverts] = await Promise.all([
    passActif ? Promise.resolve(new Set<string>()) : lireRefsOuvertes(client, 'exercise_solution', exercices),
    passActif ? Promise.resolve(new Set<string>()) : lireRefsOuvertes(client, 'document_pdf', refsDocuments),
  ]);
  for (const [i, c] of cours.entries()) {
    ajouterTache(taches, 'cours', `fiche-${c.id}`, { cours: c.id });
    for (const lecon of leconsParCours[i].lecons) {
      ajouterTache(taches, 'cours', `lecon-${lecon.id}`, { cours: c.id, lecon: lecon.id });
      ajouterTache(taches, 'quiz', `validation-${lecon.id}`, { cours: c.id, lecon: lecon.id });
    }
    for (const quiz of leconsParCours[i].activites.quiz) {
      ajouterTache(taches, 'quiz', `quiz-${quiz.id}`, { quiz: quiz.id });
    }
    for (const exercice of leconsParCours[i].activites.exercices) {
      ajouterTache(taches, 'exercices', `exercice-${exercice.id}`, { exercice: exercice.id });
      if (passActif || exercicesOuverts.has(exercice.id)) {
        ajouterTache(taches, 'exercices', `corrige-${exercice.id}`, { exercice: exercice.id, corrige: true });
      }
    }
  }

  for (const document of documents) {
    if (passActif || refsOuverts.has(document.id)) {
      ajouterTache(taches, 'pdf', `pdf-${document.id}`, { document });
    }
    if (document.correctionId && (passActif || refsOuverts.has(document.correctionId))) {
      ajouterTache(taches, 'pdf', `pdf-${document.correctionId}`, {
        document: { id: document.correctionId, titre: `${document.titre} · correction` },
      });
    }
  }
  documentsEstimes(taches, documents);

  const estimationCategories = estimerCategories(taches);
  return {
    profil: { niveau: profil.niveau, pays: profil.pays, concours: profil.concours },
    taches,
    progression: progression(taches),
    estimationOctets: octetsEstimes(taches),
    estimationCategories,
    espaceDisponible: Math.max(0, Paths.availableDiskSpace || 0),
  };
}

export function selectionnerCategories(estimation: EstimationTelechargement, categories: readonly CategorieHorsLigne[]): EstimationTelechargement {
  const choisies = new Set(categories);
  const taches = estimation.taches.filter((tache) => choisies.has(tache.categorie));
  return {
    ...estimation,
    taches,
    progression: progression(taches),
    estimationOctets: octetsEstimes(taches),
    estimationCategories: estimerCategories(taches),
  };
}

function aujourdhuiPlus(jour: string, decalage: number): string {
  const [a, m, j] = jour.split('-').map(Number);
  const date = new Date(a, m - 1, j + decalage);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function executerTache(tache: Tache): Promise<void> {
  const client = getSupabase();
  if (tache.categorie === 'missions' && tache.jour) {
    await prechargerMission(client, {
      niveau: tache.niveau ?? '3e',
      pays: tache.pays ?? 'CM',
      concours: tache.concours,
      jour: tache.jour,
      taille: tache.taille,
      vraiFaux: { vrai: i18n.t('mission.vrai'), faux: i18n.t('mission.faux') },
    });
  } else if (tache.categorie === 'cours' && tache.cours) {
    if (tache.lecon) await lireLecon(client, tache.lecon);
    else await lireFiche(client, tache.cours);
  } else if (tache.categorie === 'quiz' && tache.cours && tache.lecon) {
    const quiz = await lireQuizLecon(client, { cours: tache.cours, lecon: tache.lecon, vraiFaux: { vrai: i18n.t('mission.vrai'), faux: i18n.t('mission.faux') } });
    await AsyncStorage.setItem(`reviser.quiz.horsLigne.${tache.lecon}`, JSON.stringify(quiz));
  } else if (tache.categorie === 'quiz' && tache.quiz) {
    await lireQuizLibre(client, { quiz: tache.quiz, vraiFaux: { vrai: i18n.t('mission.vrai'), faux: i18n.t('mission.faux') } });
  } else if (tache.categorie === 'exercices' && tache.exercice) {
    if (!tache.corrige) {
      await lireExercice(client, tache.exercice);
    } else {
      const acces = await depenser<{ correction?: unknown; correction_compressed?: string | null }>(client, 'exercise_solution', tache.exercice);
      if (acces.statut !== 'already' && acces.statut !== 'unlimited') throw new Error('corrigé non débloqué : aucun crédit n’a été dépensé');
      if (!acces.contenu) throw new Error('corrigé indisponible');
      await AsyncStorage.setItem(`entrainement.exercice.corrige.${tache.exercice}`, JSON.stringify(acces.contenu));
    }
  } else if (tache.categorie === 'pdf' && tache.document) {
    const acces = await depenser<{ url?: string }>(client, 'document_pdf', tache.document.id);
    if (acces.statut !== 'already' && acces.statut !== 'unlimited') throw new Error('document non débloqué : aucun crédit n’a été dépensé');
    if (!acces.contenu?.url) throw new Error('adresse du document indisponible');
    await prechargerDocument(acces.contenu.url, tache.document.titre);
  }
}

export async function lancerTelechargement(estimation?: EstimationTelechargement | EtatHorsLigne): Promise<void> {
  await AsyncStorage.setItem(CLE_MODE_HORS_LIGNE, '1');
  const calculee = estimation ?? await estimerTelechargement();
  let notification: EtatHorsLigne['notification'] = 'refusee';
  try {
    const permission = await Notifications.getPermissionsAsync();
    const reponse = permission.granted ? permission : await Notifications.requestPermissionsAsync();
    notification = reponse.granted ? 'autorisee' : 'refusee';
  } catch (erreur) {
    notification = 'echec';
    console.warn('Impossible de vérifier l’autorisation des notifications hors ligne.', erreur);
  }
  const precedent = await lireEtatHorsLigne();
  const taches = precedent?.statut === 'partiel'
    ? precedent.taches.map((t) => t.statut === 'echec' ? { ...t, statut: 'a-faire' as const } : t)
    : calculee.taches;
  const etat: EtatHorsLigne = {
    ...calculee,
    taches,
    progression: progression(taches),
    estimationOctets: octetsEstimes(taches),
    estimationCategories: estimerCategories(taches),
    statut: 'telechargement',
    notification,
    actualiseLe: new Date().toISOString(),
  };
  await enregistrer(etat);
  void executerFile();
}

async function executerFile(): Promise<void> {
  if (execution) return execution;
  execution = (async () => {
    let etat = await lireEtatHorsLigne();
    if (!etat || etat.statut !== 'telechargement') return;
    for (const tache of etat.taches) {
      if (tache.statut !== 'a-faire') continue;
      try {
        await executerTache(tache);
        tache.statut = 'faite';
      } catch (erreur) {
        tache.statut = 'echec';
        tache.erreur = erreur instanceof Error ? erreur.message : String(erreur);
      }
      etat.progression = progression(etat.taches);
      await enregistrer(etat);
    }
    etat.statut = etat.taches.some((t) => t.statut === 'echec') ? 'partiel' : 'termine';
    await enregistrer(etat);
    if (etat.statut === 'termine') {
      if (etat.notification === 'autorisee') {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: i18n.t('horsLigne.notificationTitre'),
              body: i18n.t('horsLigne.notificationTexte'),
              data: { type: 'telechargement_hors_ligne_termine' },
            },
            trigger: null,
          });
        } catch (erreur) {
          etat.notification = 'echec';
          await enregistrer(etat);
          console.warn('La notification de préparation hors ligne n’a pas pu être programmée.', erreur);
        }
      }
    }
  })().finally(() => { execution = null; });
  return execution;
}

export function reprendreTelechargementHorsLigne(): Promise<void> {
  return executerFile();
}

export async function declinerModeHorsLigne(): Promise<void> {
  await AsyncStorage.setItem(CLE_MODE_HORS_LIGNE, '0');
  await noterInvitationHorsLigneVue();
}

export const decalageJourHorsLigne = aujourdhuiPlus;
