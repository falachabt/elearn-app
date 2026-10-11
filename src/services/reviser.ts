import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { matiere as couleursMatieres } from '@/theme/theme';

import { decoderContenu, normaliserBlocs, type Bloc } from './blocs';
import { contenuHorsLigneValide } from './connectivite';
import type { QuestionTiree } from './miniTest';
import { convertir, type LigneMission } from './mission';
import { repriseInviteEnCours } from './repriseInvite';

type Client = Pick<SupabaseClient, 'rpc'>;

export type Cours = { id: number; nom: string; matiere: string; lecons: number };
export type Matiere = { nom: string; couleur: keyof typeof couleursMatieres | null; cours: Cours[]; lecons: number };
export type Lecon = { id: number; nom: string; minutes: number | null };
export type ContenuLecon = { id: number; coursId: number; nom: string; blocs: Bloc[] };
export type Fiche = { nom: string; blocs: Bloc[] };

const CLE_COURS = (niveau: string, pays: string) => `reviser.cours.${niveau}.${pays.toUpperCase()}`;
const CLE_LECONS = (cours: number) => `reviser.lecons.${cours}`;
const CLE_LECON = (lecon: number) => `reviser.lecon.${lecon}`;
const CLE_FICHE = (cours: number) => `reviser.fiche.${cours}`;
export const TAILLE_QUIZ_LECON = 3;
export const CLE_LUES = 'reviser.lues';
export const AUTRES = 'Autres';

/** Durée pendant laquelle une copie locale est servie sans requête : le contenu des cours change rarement. */
export const FRAICHEUR_COPIE_MS = 12 * 60 * 60 * 1000;
// « v2 » : les copies sans le LaTeX des formules (avant le 01/10 après-midi) sont relues une fois.
const CLE_DATE = (cle: string) => `${cle}@v2`;

/** Copies déjà lues pendant cette session de l'application : servies sans relire le téléphone. */
const copiesEnMemoire = new Map<string, { valeur: unknown; date: number }>();
const relecturesEnCours = new Set<string>();

/** Vide les copies en mémoire (tests, changement de compte). */
export function oublierCopiesEnMemoire() {
  copiesEnMemoire.clear();
  relecturesEnCours.clear();
}

async function relireEtGarder<T>(cle: string, lire: () => Promise<T>, maintenant: number): Promise<T> {
  const valeur = await lire();
  copiesEnMemoire.set(cle, { valeur, date: maintenant });
  await AsyncStorage.multiSet([
    [cle, JSON.stringify(valeur)],
    [CLE_DATE(cle), String(maintenant)],
  ]).catch(() => {});
  return valeur;
}

/** Clés locales chargées pendant la session, quand le contenu est encore valable. */
const localesEnMemoire = new Map<string, unknown>();

/**
 * Ce contenu local peut-il encore être servi ? Faux hors ligne au-delà de la durée de validité (issue #13).
 *
 * **C'est le contrôle unique de l'expiration.** Le cache hors ligne est éparpillé en plusieurs clés rangées par la
 * préparation (`reviser.quiz.horsLigne.*`, `entrainement.exercice.corrige.*`, `mission.horsLigne.*`), et chacune a
 * son propre chemin de lecture. Les garder séparément a laissé passer des contenus : toute lecture d'une clé locale
 * doit passer par ici, et non par un `contenuHorsLigneValide()` recopié au cas par cas.
 */
export async function localServable(maintenant = Date.now()): Promise<boolean> {
  return contenuHorsLigneValide(maintenant);
}

/**
 * Lit une clé locale (rangée par la préparation hors ligne) en la soumettant à l'expiration. Renvoie `null` quand le
 * contenu est périmé : l'appelant retombe alors sur son erreur réseau, donc sur le message de connexion.
 *
 * `sansExpiration` sert aux clés qui ne sont pas du contenu (index, réglages locaux) — à n'utiliser qu'en connaissance
 * de cause.
 */
export async function lireLocalHorsLigne<T>(cle: string, maintenant = Date.now()): Promise<T | null> {
  if (!(await localServable(maintenant))) {
    localesEnMemoire.delete(cle);
    return null;
  }
  if (localesEnMemoire.has(cle)) return localesEnMemoire.get(cle) as T;
  try {
    const brut = await AsyncStorage.getItem(cle);
    if (!brut) return null;
    const valeur = JSON.parse(brut) as T;
    localesEnMemoire.set(cle, valeur);
    return valeur;
  } catch {
    return null;
  }
}

/**
 * Copie locale d'abord (M5-03) : rien n'attend le réseau dès qu'une copie existe. Moins de 12 h : servie telle quelle.
 * Plus ancienne : servie tout de suite, et relue en arrière-plan pour la visite suivante. Sans copie : le réseau.
 * L'onglet reste utilisable hors ligne pour ce qui a déjà été ouvert.
 *
 * **Expiration (issue #13)** : hors ligne, une copie plus vieille que la durée de validité hors ligne n'est **pas**
 * servie. On tente alors le réseau, qui échoue sans connexion : l'élève voit un message de connexion au lieu de
 * consulter indéfiniment du contenu périmé. C'est le point de passage unique de tous les contenus, donc le seul
 * endroit où cette règle doit vivre — la poser ailleurs la laisserait contournable.
 */
export async function avecCopie<T>(cle: string, lire: () => Promise<T>, maintenant = Date.now()): Promise<T> {
  let copie = copiesEnMemoire.get(cle);
  if (!copie) {
    const [[, texte], [, date]] = await AsyncStorage.multiGet([cle, CLE_DATE(cle)]).catch(() => [
      [cle, null],
      [CLE_DATE(cle), null],
    ]);
    if (texte && date) {
      try {
        copie = { valeur: JSON.parse(texte), date: Number(date) };
        copiesEnMemoire.set(cle, copie);
      } catch {
        // copie illisible : on relit le réseau
      }
    }
  }
  if (copie && !(await contenuHorsLigneValide(maintenant))) {
    // Copie périmée : on la refuse et on repart du réseau. La copie reste en mémoire pour la relecture d'arrière-plan,
    // qui la remplacera si la connexion est revenue.
    return relireEtGarder(cle, lire, maintenant);
  }
  if (!copie) return relireEtGarder(cle, lire, maintenant);
  if (maintenant - copie.date >= FRAICHEUR_COPIE_MS && !relecturesEnCours.has(cle)) {
    relecturesEnCours.add(cle);
    void relireEtGarder(cle, lire, maintenant)
      .catch(() => {})
      .finally(() => relecturesEnCours.delete(cle));
  }
  return copie.valeur as T;
}

export async function rpc<T>(client: Client, nom: string, args: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await client.rpc(nom, args);
  if (error) throw error;
  return (data ?? []) as T[];
}

/** Couleur constante de la matière dans toute l'app (guide, section couleurs des matières). */
export function couleurMatiere(nom: string): Matiere['couleur'] {
  const n = nom.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  if (/math/.test(n)) return 'maths';
  if (/svt|vie et de la terre|biolog/.test(n)) return 'svt';
  if (/physique|chimie|technolog/.test(n)) return 'physique';
  if (/francais|litterature/.test(n)) return 'francais';
  if (/anglais|english|allemand|espagnol|langue/.test(n)) return 'anglais';
  if (/histoire|geograph|citoyen|civique|social/.test(n)) return 'histoireGeo';
  if (/philo/.test(n)) return 'philo';
  return null;
}

/** Icône de la matière sur sa tuile ; les matières sans règle gardent la bibliothèque. */
export function iconeMatiere(nom: string): 'calculator-outline' | 'leaf-outline' | 'flask-outline' | 'create-outline' | 'language-outline' | 'earth-outline' | 'bulb-outline' | 'laptop-outline' | 'trending-up-outline' | 'football-outline' | 'color-palette-outline' | 'people-outline' | 'library-outline' {
  const n = nom.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  if (/math|algebr|geometr|statisti/.test(n)) return 'calculator-outline';
  if (/svt|vie et de la terre|biolog/.test(n)) return 'leaf-outline';
  if (/sport|\beps\b/.test(n)) return 'football-outline';
  if (/physique|chimie|technolog|pct/.test(n)) return 'flask-outline';
  if (/informatique|numerique|tic\b/.test(n)) return 'laptop-outline';
  if (/francais|litterature|redaction|grammaire/.test(n)) return 'create-outline';
  if (/anglais|english|allemand|espagnol|langue|chinois|arabe/.test(n)) return 'language-outline';
  if (/histoire|geograph/.test(n)) return 'earth-outline';
  if (/citoyen|civique|morale|ecm|social|religion/.test(n)) return 'people-outline';
  if (/philo|culture generale|logique/.test(n)) return 'bulb-outline';
  if (/econom|gestion|compta|commerce/.test(n)) return 'trending-up-outline';
  if (/\barts?\b|dessin|musique/.test(n)) return 'color-palette-outline';
  return 'library-outline';
}

/** Nom court affiché sur la tuile (« Sciences de la Vie et de la Terre, … » → « SVT »). */
export function nomCourt(nom: string): string {
  const n = nom.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  if (/vie et de la terre/.test(n)) return 'SVT';
  if (/^langue francaise/.test(n)) return 'Français';
  if (/^mathematique$/.test(n)) return 'Maths';
  if (/^english language/.test(n)) return 'English';
  if (/^sciences physiques et technologie$/.test(n)) return 'Physique et techno';
  if (/^[A-Z]{2,4}$/.test(nom)) return nom;
  return nom.charAt(0).toUpperCase() + nom.slice(1).toLowerCase().replace(/ & /g, ' et ');
}

/** Ce que lit Réviser pour un profil : le programme du concours choisi, sinon celui de la classe. */
export function programmeDu(profil: { type?: string | null; niveau?: string | null; pays?: string | null; concours?: { id: string } | null } | null) {
  return { niveau: profil?.niveau ?? '3e', pays: profil?.pays ?? 'CM', concours: profil?.type === 'concours' ? (profil.concours?.id ?? null) : null };
}

export async function lireCours(client: Client, p: { niveau: string; pays: string; concours?: string | null }): Promise<Cours[]> {
  // Un concours choisi se comporte comme une classe : son programme remplace celui de la classe.
  const cle = p.concours ? `reviser.cours.concours.${p.concours}` : CLE_COURS(p.niveau, p.pays);
  return avecCopie(cle, async () => {
    type Ligne = { course_id: number; name: string; subject: string | null; lessons: number };
    const lignes = p.concours
      ? await rpc<Ligne>(client, 'contest_courses', { p_contest: p.concours })
      : await rpc<Ligne>(client, 'revision_courses', { p_level: p.niveau, p_country: p.pays });
    return lignes.map((l) => ({ id: l.course_id, nom: l.name.trim(), matiere: l.subject?.trim() || AUTRES, lecons: l.lessons }));
  });
}

/** Matières dans l'ordre : les plus fournies d'abord, « Autres » à la fin. */
export function regrouperParMatiere(cours: readonly Cours[]): Matiere[] {
  const parNom = new Map<string, Matiere>();
  for (const c of cours) {
    const cle = nomCourt(c.matiere);
    const m = parNom.get(cle) ?? { nom: cle, couleur: couleurMatiere(c.matiere), cours: [], lecons: 0 };
    m.cours.push(c);
    m.lecons += c.lecons;
    parNom.set(cle, m);
  }
  return [...parNom.values()].sort((a, b) => (a.nom === AUTRES ? 1 : b.nom === AUTRES ? -1 : b.cours.length - a.cours.length || b.lecons - a.lecons || a.nom.localeCompare(b.nom)));
}

export async function lireLecons(client: Client, cours: number): Promise<Lecon[]> {
  return avecCopie(CLE_LECONS(cours), async () => {
    const lignes = await rpc<{ lesson_id: number; name: string | null; reading_minutes: number | null }>(client, 'course_lessons', { p_course: cours });
    return lignes.map((l) => ({ id: l.lesson_id, nom: l.name?.trim() || '', minutes: l.reading_minutes }));
  });
}

export async function lireLecon(client: Client, lecon: number): Promise<ContenuLecon> {
  return avecCopie(CLE_LECON(lecon), async () => {
    const [l] = await rpc<{ lesson_id: number; course_id: number; name: string | null; content: unknown; content_compressed: string | null }>(client, 'lesson_content', { p_lesson: lecon });
    if (!l) throw new Error('leçon introuvable');
    return { id: l.lesson_id, coursId: l.course_id, nom: l.name?.trim() || '', blocs: normaliserBlocs(decoderContenu({ compresse: l.content_compressed, brut: l.content })) };
  });
}

/** Fiche résumé du cours (M5-02) ; null si le cours n'en a pas. */
export async function lireFiche(client: Client, cours: number): Promise<Fiche | null> {
  return avecCopie(CLE_FICHE(cours), async () => {
    const [f] = await rpc<{ name: string | null; content: unknown }>(client, 'course_summary', { p_course: cours });
    if (!f) return null;
    const blocs = normaliserBlocs(decoderContenu({ brut: f.content }));
    return blocs.length ? { nom: f.name?.trim() || '', blocs } : null;
  });
}

/** 3 questions pour vérifier une leçon, tirées des quiz du cours (M5-01) ; en ligne seulement. */
export async function lireQuizLecon(client: Client, p: { cours: number; lecon: number; vraiFaux: { vrai: string; faux: string } }): Promise<QuestionTiree[]> {
  // Le tirage est stable par leçon et par jour côté serveur : la copie du jour s'ouvre sans attente.
  const jour = new Date().toISOString().slice(0, 10);
  try {
    return await avecCopie(`reviser.quiz.${p.lecon}.${jour}`, async () => {
      const lignes = await rpc<LigneMission>(client, 'lesson_quiz', { p_course: p.cours, p_lesson: p.lecon, p_size: TAILLE_QUIZ_LECON });
      return lignes.map((l) => convertir(l, p.vraiFaux)).filter((q): q is QuestionTiree => q !== null);
    });
  } catch (erreur) {
    // Repli hors ligne : la copie rangée par la préparation, soumise à l'expiration (voir `lireLocalHorsLigne`).
    const horsLigne = await lireLocalHorsLigne<QuestionTiree[]>(`reviser.quiz.horsLigne.${p.lecon}`);
    if (horsLigne) return horsLigne;
    throw erreur;
  }
}

export const CLE_DERNIERE_LECON = 'reviser.derniereLecon';
/** Dernière leçon ouverte : « Reprendre » de l'accueil et leçon en cours sur la page du cours. */
export type DerniereLecon = { id: number; cours: number; nom: string; numero: number; minutes: number | null; quand: number };

export async function noterDerniereLecon(l: Omit<DerniereLecon, 'quand'>, maintenant = Date.now()): Promise<void> {
  await AsyncStorage.setItem(CLE_DERNIERE_LECON, JSON.stringify({ ...l, quand: maintenant })).catch(() => {});
}

export async function lireDerniereLecon(): Promise<DerniereLecon | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE_DERNIERE_LECON);
    return brut ? (JSON.parse(brut) as DerniereLecon) : null;
  } catch {
    return null;
  }
}

/** Leçons lues : identifiant de leçon → identifiant de cours, pour le « % vu » par matière. */
export async function lireLues(): Promise<Record<string, number>> {
  const brut = await AsyncStorage.getItem(CLE_LUES);
  return brut ? (JSON.parse(brut) as Record<string, number>) : {};
}

/** Leçon validée : au moins deux tiers de ses questions justes (2 sur 3). */
export function quizReussi(score: number, total: number): boolean {
  return total > 0 && score >= Math.ceil((total * 2) / 3);
}

/**
 * Marque la leçon comme validée : elle compte alors dans la progression (questions réussies, ou leçon sans questions).
 * Enregistrée sur le téléphone tout de suite, puis envoyée au serveur sans bloquer quand un client est donné.
 */
export async function marquerLue(lecon: number, cours: number, client?: ClientSynchro, resultat?: { score: number; total: number }): Promise<void> {
  const lues = await lireLues();
  if (lues[lecon] !== cours) await AsyncStorage.setItem(CLE_LUES, JSON.stringify({ ...lues, [lecon]: cours }));
  if (client) {
    void client.rpc('validate_lessons', { p_items: [{ lesson_id: lecon, course_id: cours, ...resultat }] }).then(
      () => undefined,
      () => undefined,
    );
  }
}

type ClientSynchro = Pick<SupabaseClient, 'rpc' | 'from'>;

/**
 * Met en commun les leçons validées du téléphone et du compte : celles du compte reviennent sur le téléphone (autre
 * appareil, après une déconnexion), celles faites hors ligne partent au serveur. Sans réseau, rien ne change.
 */
export async function synchroniserLues(client: ClientSynchro, forcer = false): Promise<Record<string, number>> {
  const locales = await lireLues();
  if (!forcer && repriseInviteEnCours()) return locales;
  try {
    const { data, error } = await client.from('lesson_validations').select('lesson_id, course_id');
    if (error) throw error;
    const serveur = (data ?? []) as { lesson_id: number; course_id: number }[];
    const connues = new Set(serveur.map((l) => String(l.lesson_id)));
    const aEnvoyer = Object.entries(locales)
      .filter(([id]) => !connues.has(id))
      .map(([id, cours]) => ({ lesson_id: Number(id), course_id: cours }));
    if (aEnvoyer.length) await client.rpc('validate_lessons', { p_items: aEnvoyer });
    // Relecture juste avant d'écrire : une leçon validée pendant l'attente du serveur ne doit pas être écrasée par la
    // photo prise au début (la case cochée disparaîtrait).
    const fusion = { ...locales, ...(await lireLues()), ...Object.fromEntries(serveur.map((l) => [String(l.lesson_id), l.course_id])) };
    await AsyncStorage.setItem(CLE_LUES, JSON.stringify(fusion));
    return fusion;
  } catch {
    return locales;
  }
}

/** Part des leçons lues (0 à 100) pour une liste de cours. */
export function pourcentageVu(cours: readonly Cours[], lues: Record<string, number>): number {
  const total = cours.reduce((n, c) => n + c.lecons, 0);
  if (!total) return 0;
  const ids = new Set(cours.map((c) => c.id));
  const vues = Object.values(lues).filter((c) => ids.has(c)).length;
  return Math.min(100, Math.round((vues / total) * 100));
}
