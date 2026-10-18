/**
 * Contenu embarqué pour essayer le profil TOEIC sur Expo web sans serveur. OUTIL DE DÉVELOPPEMENT : actif seulement si
 * `__DEV__` et `EXPO_PUBLIC_CERT_DEMO=1` (voir `api.ts`), absent des builds de production. Ne fabrique aucune règle :
 * les paramètres viennent de `reglages.json` (extrait de la migration), les formules de `certScore`. Les médias restent
 * sur R2 (`EXPO_PUBLIC_CERT_MEDIA_BASE`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CertApi, ExplicationAchetee } from '../api';
import { etatMaitrise } from '../certMaitrise';
import { jourDe, jourPlus } from '../jours';
import { plageScore } from '../certScore';
import { lireReglages } from '../reglages';
import type { BlocServi, DemarrageMini, EtatGains, Examen, FinTentative, GroupeServi, MotCarnetServi, MotsARevoir, NotionFiche, NotionListee, PartieMaitrise, PeriodeStats, QuestionServie, ReponseEnvoyee, ResultatReponse, Stats, Tentative, TentativeListee } from '../types';
import contenu from './contenu.json';
import reglagesBruts from './reglages.json';

type Q = (typeof contenu.questions)[number];
type G = (typeof contenu.groupes)[number];
type EtatMotDemo = { boite: 1 | 2 | 3 | 4; prochaineRevue: string; vus: number; bons: number; mauvais: number };
type Store = {
  tentatives: Record<string, { tentative: Tentative; reponses: Record<string, ReponseEnvoyee> }>;
  motsRates: number[];
  /** Réponses données par partie, pour la maîtrise de la carte (démo seulement). */
  parties: Record<string, { n: number; c: number }>;
  mots: Record<string, EtatMotDemo>;
  ouvertes: Record<string, string>;
  historique: TentativeListee[];
  gains: string[];
};

/** Mots de démonstration du carnet (outil de développement, hors production) : définitions et exemples originaux. */
const MOTS_DEMO = [
  ['postpone', 'Verbe', 'reporter, remettre à plus tard', 'They decided to postpone the meeting.', 'bureau'],
  ['deadline', 'Nom', 'date limite', 'The deadline is Friday.', 'bureau'],
  ['invoice', 'Nom', 'facture', 'Please send the invoice by email.', 'finance'],
  ['quarterly', 'Adjectif', 'trimestriel', 'The quarterly report is ready.', 'finance'],
  ['attend', 'Verbe', 'assister à', 'Most staff attend the weekly meeting.', 'bureau'],
  ['supplier', 'Nom', 'fournisseur', 'Our supplier delivers on Mondays.', 'achats'],
  ['refund', 'Nom', 'remboursement', 'You may request a refund within a week.', 'achats'],
  ['schedule', 'Nom', 'emploi du temps, calendrier', 'The schedule changed this morning.', 'bureau'],
] as const;

const CLE = 'cert.demo.store';
const EXAMEN: Examen = {
  code: 'toeic',
  name: 'TOEIC Listening and Reading',
  subtitle: 'Anglais des affaires',
  duration_min: 120,
  question_count: 200,
  goal_steps: [600, 700, 800, 900],
  sec_per_question: { listening: 27, reading: 45 },
};
const groupes = new Map<string, G>(contenu.groupes.map((g) => [g.id, g]));
const questions = new Map<string, Q>(contenu.questions.map((q) => [q.id, q]));
const notions = new Map(contenu.notions.map((n) => [n.part, { id: n.id, code: n.code, title: n.title, family: n.family as 'grammaire' | 'methode' }]));
const reglages = lireReglages(reglagesBruts as { key: string; value: unknown }[]);
const reglagesSerie = Number(((reglagesBruts as { key: string; value: unknown }[]).find((l) => l.key === 'series_size') ?? { value: 10 }).value);
const blueprint = (reglagesBruts as { key: string; value: unknown }[]).find((l) => l.key === 'diag_blueprint')!.value as Record<string, number>;

async function lire(): Promise<Store> {
  try {
    const brut = await AsyncStorage.getItem(CLE);
    if (brut) return { tentatives: {}, motsRates: [], parties: {}, mots: {}, ouvertes: {}, historique: [], gains: [], ...(JSON.parse(brut) as Partial<Store>) };
  } catch {
    // magasin illisible : on repart de zéro
  }
  return { tentatives: {}, motsRates: [], parties: {}, mots: {}, ouvertes: {}, historique: [], gains: [] };
}
const ecrire = (s: Store) => AsyncStorage.setItem(CLE, JSON.stringify(s)).catch(() => {});

function servir(q: Q): QuestionServie {
  const g = q.group ? groupes.get(q.group) : null;
  return {
    id: q.id,
    part: q.part,
    type: q.type,
    number: q.number,
    stem: q.stem,
    options: q.options,
    group: g ? { id: g.id, audio_path: g.audio_path, image_path: g.image_path, image_alt: g.image_alt, passage: g.passage as GroupeServi['passage'] } : null,
  };
}

/** Tirage par groupes entiers, dans l'ordre servi du plan : le dernier groupe est tronqué pour tomber juste. */
function tirer(partie: number, n: number): Q[] {
  const unites = new Map<string, Q[]>();
  for (const q of contenu.questions.filter((x) => x.part === partie)) {
    const cle = q.group ?? q.id;
    unites.set(cle, [...(unites.get(cle) ?? []), q]);
  }
  const melanges = [...unites.values()].sort(() => Math.random() - 0.5);
  const sortie: Q[] = [];
  for (const u of melanges) {
    if (sortie.length >= n) break;
    sortie.push(...u.slice(0, n - sortie.length));
  }
  return sortie;
}

function corriger(r: ReponseEnvoyee): ResultatReponse {
  const q = questions.get(r.question_id)!;
  const g = q.group ? groupes.get(q.group) : null;
  const juste = r.chosen === q.correct;
  return {
    question_id: q.id,
    client_uuid: r.client_uuid,
    correct: juste,
    skipped: r.chosen === null,
    correct_index: q.correct,
    trap: null,
    notion: notions.get(q.part) ?? null,
    notions: [],
    words: [],
    transcript: g?.transcript ?? null,
    replay: false,
  };
}

/** Statistiques de démonstration (outil de développement) : activées par `EXPO_PUBLIC_CERT_DEMO_STATS=1`, jamais en production. */
function statsDemoFixes(periode: PeriodeStats, jour: Parameters<typeof jourPlus>[0]): Stats {
  const parties: [number, number, number][] = [
    [1, 18, 15], [2, 14, 9], [3, 12, 10], [4, 16, 8], [5, 20, 13], [6, 10, 6], [7, 30, 19],
  ];
  return {
    status: 'ok',
    periode,
    reponsesTotal: parties.reduce((a, [, n]) => a + n, 0),
    score: { estime: true, min: 620, max: 700 },
    barres: [
      { fin: jourPlus(jour, -21), min: 540, max: 600, milieu: 570 },
      { fin: jourPlus(jour, -14), min: 580, max: 640, milieu: 610 },
      { fin: jourPlus(jour, -7), min: 600, max: 660, milieu: 630 },
      { fin: jour, min: 620, max: 700, milieu: 660 },
    ],
    tendance: 'up',
    parties: parties.map(([partie, n, c]) => {
      const m = c / n;
      return { partie, repondues: n, bonnes: c, taux: m, maitrise: m, reponsesMaitrise: n, etat: etatMaitrise(m, n, reglages) };
    }),
    minutesSeances: 95,
    minutesLecture: 40,
    joursSur7: 4,
    seances: 6,
    serieJours: 3,
    mots: { aRevoir: 5, enCours: 12, connus: 30 },
    calculeLe: new Date().toISOString(),
  };
}

export const apiDemo: CertApi = {
  async listerExamens() {
    return [EXAMEN];
  },
  async lireReglages() {
    return reglagesBruts as { key: string; value: unknown }[];
  },
  async enregistrerPlan() {},
  async demarrerDiagnostic(clientUuid) {
    const s = await lire();
    const existante = s.tentatives[clientUuid];
    if (existante) return { ...existante.tentative, replay: true };
    const choisies = Object.entries(blueprint)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .flatMap(([partie, n]) => tirer(Number(partie), Number(n)));
    const tentative: Tentative = {
      attempt_id: `demo-${clientUuid}`,
      kind: 'diagnostic',
      part: null,
      length: choisies.length,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      credits_spent: 0,
      questions: choisies.map(servir),
      replay: false,
    };
    s.tentatives[clientUuid] = { tentative, reponses: {} };
    await ecrire(s);
    return tentative;
  },
  async envoyerReponses(reponses) {
    const resultats = reponses.map(corriger);
    const s = await lire();
    reponses.forEach((r, i) => {
      const part = String(questions.get(r.question_id)?.part ?? 0);
      const e = (s.parties[part] ??= { n: 0, c: 0 });
      e.n += 1;
      e.c += resultats[i].correct ? 1 : 0;
    });
    await ecrire(s);
    return resultats;
  },
  async terminerTentative(tentativeId, reponses) {
    const s = await lire();
    const entree = Object.values(s.tentatives).find((t) => t.tentative.attempt_id === tentativeId);
    const resultats = reponses.map(corriger);
    const parPartie: FinTentative['per_part'] = {};
    for (const res of resultats) {
      const q = questions.get(res.question_id)!;
      const e = (parPartie[String(q.part)] ??= { answered: 0, correct: 0 });
      e.answered += 1;
      e.correct += res.correct ? 1 : 0;
      if (!res.correct && (q.part === 5 || q.part === 7) && q.number % 3 === 0 && !s.motsRates.includes(q.number % 10)) s.motsRates.push(q.number % 10);
    }
    const somme = (parties: number[]) => parties.reduce((a, p) => ({ bonnes: a.bonnes + (parPartie[String(p)]?.correct ?? 0), repondues: a.repondues + (parPartie[String(p)]?.answered ?? 0) }), { bonnes: 0, repondues: 0 });
    const plage = plageScore(somme([1, 2, 3, 4]), somme([5, 6, 7]), reglages);
    for (const [part, e] of Object.entries(parPartie)) {
      const cumul = (s.parties[part] ??= { n: 0, c: 0 });
      cumul.n += e.answered;
      cumul.c += e.correct;
    }
    const kind = entree?.tentative.kind ?? 'diagnostic';
    // Mini-test par partie : pas de fourchette de score (E-38).
    const avecScore = plage.estime && !(kind === 'mini' && entree?.tentative.part !== null);
    if (entree) {
      entree.tentative.status = 'finished';
      if (kind === 'mini') {
        s.historique.unshift({
          id: tentativeId, kind, part: entree.tentative.part, length: entree.tentative.length, status: 'finished',
          scoreMin: avecScore ? plage.min : null, scoreMax: avecScore ? plage.max : null, startedAt: entree.tentative.started_at,
          finishedAt: new Date().toISOString(), perPart: parPartie, timePerPart: null, creditsSpent: 0, refunded: false, questions: entree.tentative.questions.map((q) => q.id),
        });
      }
    }
    await ecrire(s);
    return {
      status: 'finished',
      attempt_id: tentativeId,
      kind,
      estimated: avecScore,
      score: avecScore ? plage.score : null,
      score_min: avecScore ? plage.min : null,
      score_max: avecScore ? plage.max : null,
      per_part: parPartie,
      results: resultats,
      replay: false,
    };
  },
  async lireSerie(perimetre, _exam, taille) {
    const n = taille ?? reglagesSerie;
    const partieNotion = perimetre.notion ? contenu.notions.find((x) => x.id === perimetre.notion)?.part : undefined;
    if (partieNotion) return tirer(partieNotion, n).map(servir);
    if (perimetre.part) return tirer(perimetre.part, n).map(servir);
    const parties = [1, 2, 3, 4, 5, 6, 7];
    return Array.from({ length: n }, (_, i) => tirer(parties[i % parties.length], 1)[0]).filter(Boolean).map(servir);
  },
  async ajouterMot() {},
  /** Pas de crédits sur Expo web sans serveur : l'explication s'ouvre directement. */
  async acheterExplication(questionId): Promise<ExplicationAchetee> {
    const q = questions.get(questionId);
    return { statut: 'unlimited', cout: 0, solde: 0, contenu: { explanation: q?.explanation ?? null, trap: null } };
  },
  async motsARevoir(): Promise<MotsARevoir> {
    const s = await lire();
    return { total: s.motsRates.length, theme: s.motsRates.length ? 'bureau' : null };
  },
  async lireRevision() {
    const s = await lire();
    const parties: PartieMaitrise[] = [1, 2, 3, 4, 5, 6, 7].map((partie) => {
      const e = s.parties[String(partie)] ?? { n: 0, c: 0 };
      const m = e.n ? e.c / e.n : 0;
      return { partie, reponses: e.n, m, etat: etatMaitrise(e.n ? m : null, e.n, reglages) };
    });
    const liste: NotionListee[] = contenu.notions.map((n) => {
      const p = parties[n.part - 1];
      return {
        id: n.id, code: n.code, titre: n.title, famille: n.family as NotionListee['famille'], parties: [n.part], dureeMin: 3, fiche: true,
        reponses: p.reponses, reussies: Math.round(p.m * p.reponses), etat: p.etat, derniereOuverture: s.ouvertes[n.id] ?? null,
      };
    });
    return { notions: liste, parties };
  },
  async lireCarnet() {
    const s = await lire();
    const aujourdhui = jourDe(new Date());
    return MOTS_DEMO.map(([mot, categorie, definition, exemple, theme]): MotCarnetServi => {
      const e = s.mots[mot] ?? { boite: 1, prochaineRevue: aujourdhui, vus: 0, bons: 0, mauvais: 0 };
      return { id: mot, mot, categorie, definition, exemple, theme, audio: null, boite: e.boite, prochaineRevue: e.prochaineRevue, vus: e.vus, bons: e.bons, mauvais: e.mauvais };
    });
  },
  async composerSeance(exam, minutes, jour, eviterPartie) {
    const { notions: liste, parties } = await apiDemo.lireRevision(exam, jour);
    const carnet = await apiDemo.lireCarnet(exam);
    const budget = reglages.budgetSeance[String(minutes)];
    if (!budget) throw new Error('durée de séance invalide');
    const blocs: BlocServi[] = [];
    const notion = [...liste].sort((a, b) => a.reponses - b.reponses)[0];
    if (notion) blocs.push({ type: 'cours', notionId: notion.id, titre: notion.titre, minutes: budget.notionMin, erreurs: 0 });
    const echus = carnet.filter((m) => m.prochaineRevue <= jour).length;
    if (echus > 0) blocs.push({ type: 'mots', nombre: Math.min(echus, budget.mots), echus });
    const partie = [...parties].sort((a, b) => Number(a.partie === eviterPartie) - Number(b.partie === eviterPartie) || a.m - b.m)[0];
    if (partie) blocs.push({ type: 'serie', partie: partie.partie, nombre: budget.serie });
    return { minutes, blocs, pourquoi: { erreurs: 0, notion: null, motsEchus: echus } };
  },
  async lireNotion(notionId): Promise<NotionFiche> {
    const n = contenu.notions.find((x) => x.id === notionId);
    if (!n) throw new Error('notion introuvable');
    const ancrages = tirer(n.part, 3).map(servir);
    const markdown = ['## Règle', `Fiche de démonstration : ${n.title}.`, '', '## Exemples', '- This is a demo example. | Ceci est un exemple de démonstration.', '', '## Piège', 'Lis toute la phrase avant de choisir.'].join('\n');
    return { id: n.id, code: n.code, famille: n.family as NotionFiche['famille'], titre: n.title, parties: [n.part], markdown, dureeMin: 3, ancrages };
  },
  async ouvrirNotion(notionId, _secondes, jour) {
    const s = await lire();
    s.ouvertes[notionId] = jour;
    await ecrire(s);
  },
  async envoyerResultatsMots(resultats) {
    const s = await lire();
    for (const r of resultats) {
      const avant = s.mots[r.wordId] ?? { boite: 1 as const, prochaineRevue: r.jour, vus: 0, bons: 0, mauvais: 0 };
      const boite = (r.connu ? Math.min(4, avant.boite + 1) : 1) as 1 | 2 | 3 | 4;
      s.mots[r.wordId] = {
        boite, prochaineRevue: jourPlus(r.jour, reglages.delaisBoitesJours[boite - 1]),
        vus: avant.vus + 1, bons: avant.bons + (r.connu ? 1 : 0), mauvais: avant.mauvais + (r.connu ? 0 : 1),
      };
    }
    await ecrire(s);
  },
  async terminerSeance() {},
  /** Sans serveur, pas de crédits sur Expo web : le mini-test est gratuit (outil de développement). */
  async demarrerMini(clientUuid, _exam, partie, longueur): Promise<DemarrageMini> {
    const s = await lire();
    const existante = s.tentatives[clientUuid];
    if (existante) return { status: 'replay', tentative: { ...existante.tentative, replay: true }, cout: 0, solde: 0 };
    const choisies = partie
      ? tirer(partie, longueur)
      : Object.entries(blueprint)
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .flatMap(([p, n]) => tirer(Number(p), Math.round((Number(n) * longueur) / 20) || 1))
          .slice(0, longueur);
    const tentative: Tentative = {
      attempt_id: `demo-${clientUuid}`, kind: 'mini', part: partie, length: choisies.length, status: 'in_progress',
      started_at: new Date().toISOString(), credits_spent: 0, questions: choisies.map(servir), replay: false,
    };
    s.tentatives[clientUuid] = { tentative, reponses: {} };
    await ecrire(s);
    return { status: 'started', tentative, cout: 0, solde: 0 };
  },
  async lireTentative(id) {
    const s = await lire();
    const e = Object.values(s.tentatives).find((x) => x.tentative.attempt_id === id);
    if (!e) throw new Error('tentative introuvable');
    return e.tentative;
  },
  async abandonnerTentative(id) {
    const s = await lire();
    const e = Object.values(s.tentatives).find((x) => x.tentative.attempt_id === id);
    if (e) e.tentative.status = 'abandoned';
    await ecrire(s);
    return { statut: 'abandoned' as const, rembourse: true, solde: 0 };
  },
  async listerTentatives() {
    return (await lire()).historique;
  },
  async lireStats(_exam, periode, jour): Promise<Stats> {
    // Jeu de données fixe pour capturer les tuiles de Statistiques (ST1) sans avoir répondu à des questions.
    if (process.env.EXPO_PUBLIC_CERT_DEMO_STATS === '1') return statsDemoFixes(periode, jour);
    const s = await lire();
    const total = Object.values(s.parties).reduce((a, p) => a + p.n, 0);
    const base: Stats = {
      status: 'empty', periode, reponsesTotal: total, score: null, barres: [], tendance: null, parties: [], minutesSeances: 0, minutesLecture: 0,
      joursSur7: 0, seances: 0, serieJours: 0, mots: { aRevoir: s.motsRates.length, enCours: 0, connus: 0 }, calculeLe: new Date().toISOString(),
    };
    if (total === 0) return base;
    const dernier = s.historique.find((h) => h.scoreMin !== null);
    return {
      ...base,
      status: dernier && s.historique.filter((h) => h.scoreMin !== null).length >= 2 ? 'ok' : 'first_week',
      score: dernier ? { estime: true, min: dernier.scoreMin, max: dernier.scoreMax } : null,
      barres: s.historique.filter((h) => h.scoreMin !== null && h.scoreMax !== null).slice(0, 6).reverse().map((h) => ({ fin: (h.finishedAt ?? jour).slice(0, 10), min: h.scoreMin!, max: h.scoreMax!, milieu: Math.round((h.scoreMin! + h.scoreMax!) / 2) })),
      parties: [1, 2, 3, 4, 5, 6, 7].map((partie) => {
        const e = s.parties[String(partie)] ?? { n: 0, c: 0 };
        const m = e.n ? e.c / e.n : 0;
        return { partie, repondues: e.n, bonnes: e.c, taux: e.n ? m : null, maitrise: m, reponsesMaitrise: e.n, etat: etatMaitrise(e.n ? m : null, e.n, reglages) };
      }),
    };
  },
  async lireGains(): Promise<EtatGains> {
    const s = await lire();
    const cle = (k: string) => Number(((reglagesBruts as { key: string; value: unknown }[]).find((l) => l.key === k) ?? { value: 0 }).value);
    return {
      plafond: cle('cert_earn_weekly_cap'), gagneSemaine: 0, serie: 0,
      gains: [
        { code: 'session_done', montant: cle('cert_earn_session_done'), progression: 0, cible: 7, deja: s.gains.includes('session_done') },
        { code: 'streak_7', montant: cle('cert_earn_streak_7'), progression: 0, cible: cle('cert_earn_streak_days') },
        { code: 'goal_reached', montant: cle('cert_earn_goal_reached'), deja: s.gains.includes('goal_reached') },
        { code: 'mini_first', montant: cle('cert_earn_mini_first'), deja: s.gains.includes('mini_first') },
      ],
    };
  },
  async reclamerGain(code) {
    const s = await lire();
    if (s.gains.includes(code)) return { status: 'already' as const };
    s.gains.push(code);
    await ecrire(s);
    return { status: 'granted' as const, montant: 0 };
  },
};

