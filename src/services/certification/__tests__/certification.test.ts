import { composerSeanceMots, appliquerResultatMot, compterBoites, etatMot, motEchu, nouveauMot, type MotCarnet } from '../certCarnet';
import { maitrise, etatMaitrise } from '../certMaitrise';
import { etatRejeuApres, rejeuEchu } from '../certRejeu';
import { plageScore, scoreSection, sectionDe, wilson } from '../certScore';
import { choisirNotion, choisirPartie, composerSeance, type NotionSeance } from '../certSeance';
import { ecartJours, joursAvantTest, jourPlus } from '../jours';
import { lireReglages } from '../reglages';
import { LIGNES_SEED, REGLAGES as R } from './fixtures';

describe('réglages (R-04)', () => {
  it('refuse un paramètre absent plutôt que de deviner un seuil', () => {
    expect(() => lireReglages(LIGNES_SEED.filter((l) => l.key !== 'score_z'))).toThrow('score_z');
  });
  it('refuse un paramètre illisible', () => {
    expect(() => lireReglages(LIGNES_SEED.map((l) => (l.key === 'box_delays_days' ? { ...l, value: ['a'] } : l)))).toThrow('box_delays_days');
  });
});

describe('jours (F8)', () => {
  it('compte les jours calendaires, année bissextile comprise', () => {
    expect(ecartJours('2028-02-28', '2028-03-01')).toBe(2);
    expect(ecartJours('2027-02-28', '2027-03-01')).toBe(1);
    expect(jourPlus('2028-02-28', 1)).toBe('2028-02-29');
  });
  it('AC-F8 : sans date aucune ligne, date passée négative', () => {
    expect(joursAvantTest(null, '2026-10-15')).toBeNull();
    expect(joursAvantTest('2026-11-26', '2026-10-15')).toBe(42);
    expect(joursAvantTest('2026-10-10', '2026-10-15')).toBe(-5);
  });
});

describe('score F1 / F2 (identique à cert_score_range côté serveur)', () => {
  const s = (cl: number, al: number, cr: number, ar: number) => plageScore({ bonnes: cl, repondues: al }, { bonnes: cr, repondues: ar }, R);
  it.each([
    [5, 10, 5, 10, 500, 320, 680],
    [10, 10, 10, 10, 990, 850, 990],
    [7, 10, 3, 10, 500, 330, 670],
    [0, 10, 10, 10, 500, 430, 570],
    [50, 100, 50, 100, 500, 440, 560],
  ])('%i/%i et %i/%i donnent %i entre %i et %i', (cl, al, cr, ar, score, min, max) => {
    expect(s(cl, al, cr, ar)).toEqual({ estime: true, score, min, max });
  });
  it('S8 : sous le minimum de réponses, aucune estimation', () => {
    expect(s(3, 5, 3, 5)).toEqual({ estime: false, reponses: 10 });
  });
  it('AC-T-3 : plus de réponses, fourchette plus étroite', () => {
    const large = s(5, 10, 5, 10) as { min: number; max: number };
    const etroite = s(50, 100, 50, 100) as { min: number; max: number };
    expect(etroite.max - etroite.min).toBeLessThan(large.max - large.min);
  });
  it('une section sans réponse a la fourchette maximale', () => {
    expect(wilson(0, 0, R.scoreZ)).toEqual([0, 1]);
  });
  it('borne la section à [5 ; 495] et au multiple de 5', () => {
    expect(scoreSection(0)).toBe(5);
    expect(scoreSection(1)).toBe(495);
    expect(scoreSection(0.5)).toBe(250);
  });
  it('Listening = parties 1 à 4, Reading = 5 à 7', () => {
    expect([1, 4, 5, 7].map(sectionDe)).toEqual(['listening', 'listening', 'reading', 'reading']);
  });
});

describe('maîtrise F3 / F4', () => {
  const j = '2026-10-15';
  it('0 réponse : pas commencée', () => {
    expect(maitrise([], j, R)).toEqual({ m: null, reponses: 0, reussies: 0, etat: 'pas_commencee' });
  });
  it('seuils exacts 0,40 et 0,70', () => {
    expect(etatMaitrise(0.399, 5, R)).toBe('fragile');
    expect(etatMaitrise(0.4, 5, R)).toBe('en_progres');
    expect(etatMaitrise(0.7, 5, R)).toBe('acquise');
    expect(etatMaitrise(0.699, 5, R)).toBe('en_progres');
  });
  it('une seule réponse compte (seuil minimal réglable)', () => {
    expect(maitrise([{ juste: true, jour: j }], j, R).etat).toBe('acquise');
    expect(maitrise([{ juste: false, jour: j }], j, R).etat).toBe('fragile');
  });
  it('une réponse ancienne de la demi-vie pèse moitié moins', () => {
    const m = maitrise([{ juste: true, jour: jourPlus(j, -R.maitriseDemiVieJours) }, { juste: false, jour: j }], j, R);
    expect(m.m).toBeCloseTo(0.5 / 1.5, 6);
    expect(m.reponses).toBe(2);
    expect(m.reussies).toBe(1);
  });
  it('une réponse secondaire pèse la moitié d’une principale', () => {
    const m = maitrise([{ juste: true, jour: j, poids: 0.5 }, { juste: false, jour: j, poids: 1 }], j, R);
    expect(m.m).toBeCloseTo(0.5 / 1.5, 6);
  });
});

describe('carnet F5', () => {
  const j = '2026-10-15';
  it('un mot entre en boîte 1 avec le premier délai', () => {
    const m = nouveauMot('a', j, R);
    expect(m.boite).toBe(1);
    expect(m.prochaineRevue).toBe(jourPlus(j, R.delaisBoitesJours[0]));
  });
  it('réussite : boîte + 1 jusqu’à 4 ; échec : retour en boîte 1', () => {
    let m = nouveauMot('a', j, R);
    for (let i = 0; i < 5; i++) m = appliquerResultatMot(m, true, j, R);
    expect(m.boite).toBe(4);
    expect(m.prochaineRevue).toBe(jourPlus(j, R.delaisBoitesJours[3]));
    m = appliquerResultatMot(m, false, j, R);
    expect(m.boite).toBe(1);
    expect(m.mauvais).toBe(1);
  });
  it('états À revoir, En cours, Connu', () => {
    expect([1, 2, 3, 4].map(etatMot)).toEqual(['a_revoir', 'en_cours', 'en_cours', 'connu']);
  });
  const mot = (id: string, boite: 1 | 2 | 3 | 4, rev: string): MotCarnet => ({ motId: id, boite, prochaineRevue: rev, vus: 0, bons: 0, mauvais: 0 });
  it('séance de mots : échus seulement, boîte croissante puis échéance, taille limitée', () => {
    const mots = [mot('d', 2, '2026-10-10'), mot('b', 1, '2026-10-14'), mot('a', 1, '2026-10-12'), mot('f', 1, '2026-10-20'), mot('c', 3, '2026-10-01')];
    expect(composerSeanceMots(mots, j, 10).map((m) => m.motId)).toEqual(['a', 'b', 'd', 'c']);
    expect(composerSeanceMots(mots, j, 2).map((m) => m.motId)).toEqual(['a', 'b']);
    expect(motEchu(mots[3], j)).toBe(false);
  });
  it('aucun mot échu : séance vide (non proposée)', () => {
    expect(composerSeanceMots([mot('x', 1, '2026-12-01')], j, 10)).toEqual([]);
  });
  it('compte les boîtes pour les statistiques', () => {
    expect(compterBoites([mot('a', 1, j), mot('b', 2, j), mot('c', 3, j), mot('d', 4, j)])).toEqual({ a_revoir: 1, en_cours: 2, connu: 1 });
  });
});

describe('rejeu F6', () => {
  const j = '2026-10-15';
  it('erreur : premier délai, série à zéro', () => {
    expect(etatRejeuApres(null, false, j, R)).toEqual({ prochaineRevue: jourPlus(j, R.delaisRejeuJours[0]), serie: 0 });
  });
  it('première réussite : délai suivant ; seconde : retrait', () => {
    const a = etatRejeuApres(null, false, j, R);
    const b = etatRejeuApres(a, true, j, R);
    expect(b).toEqual({ prochaineRevue: jourPlus(j, R.delaisRejeuJours[1]), serie: 1 });
    expect(etatRejeuApres(b, true, j, R).prochaineRevue).toBeNull();
  });
  it('une erreur ramène au premier délai', () => {
    const b = etatRejeuApres(etatRejeuApres(null, false, j, R), true, j, R);
    expect(etatRejeuApres(b, false, j, R).serie).toBe(0);
  });
  it('une réussite hors rejeu ne planifie rien', () => {
    expect(etatRejeuApres(null, true, j, R)).toEqual({ prochaineRevue: null, serie: 0 });
  });
  it('échéance', () => {
    expect(rejeuEchu({ prochaineRevue: '2026-10-15', serie: 0 }, j)).toBe(true);
    expect(rejeuEchu({ prochaineRevue: '2026-10-16', serie: 0 }, j)).toBe(false);
    expect(rejeuEchu({ prochaineRevue: null, serie: 2 }, j)).toBe(false);
  });
});

describe('séance du jour F7', () => {
  const j = '2026-10-15';
  const m = (v: number | null, etat: 'fragile' | 'en_progres' | 'acquise' | 'pas_commencee') => ({ m: v, reponses: v === null ? 0 : 5, reussies: 0, etat });
  const notion = (id: string, ordre: number, mm: ReturnType<typeof m>, erreurs: string[], ouverte: string | null = null): NotionSeance =>
    ({ id, ordre, maitrise: mm, erreurs, derniereOuverture: ouverte, titre: `Notion ${id}` });

  it('choisit la notion la plus faible avec une erreur récente', () => {
    const notions = [notion('a', 1, m(0.5, 'en_progres'), ['2026-10-14']), notion('b', 2, m(0.2, 'fragile'), ['2026-10-13', '2026-10-14'])];
    expect(choisirNotion(notions, j, R)?.notion.id).toBe('b');
    expect(choisirNotion(notions, j, R)?.erreursRecentes).toBe(2);
  });
  it('ignore une fiche ouverte depuis moins du refroidissement et les erreurs trop anciennes', () => {
    const notions = [notion('a', 1, m(0.1, 'fragile'), ['2026-10-14'], '2026-10-14'), notion('b', 2, m(0.3, 'fragile'), ['2026-09-01'])];
    expect(choisirNotion(notions, j, R)?.notion.id).not.toBe('a');
    expect(choisirNotion(notions, j, R)).toBeNull();
  });
  it('sans erreur récente : première notion pas commencée dans l’ordre du référentiel', () => {
    const notions = [notion('z', 9, m(null, 'pas_commencee'), []), notion('y', 3, m(null, 'pas_commencee'), [])];
    expect(choisirNotion(notions, j, R)?.notion.id).toBe('y');
  });
  it('partie la plus faible, différente de celle de la veille', () => {
    const parties = [{ partie: 5, maitrise: m(0.1, 'fragile') }, { partie: 2, maitrise: m(0.3, 'fragile') }, { partie: 7, maitrise: m(0.9, 'acquise') }];
    expect(choisirPartie(parties, null)).toBe(5);
    expect(choisirPartie(parties, 5)).toBe(2);
    expect(choisirPartie([parties[0]], 5)).toBe(5);
  });
  const entree = (minutes: number, extra = {}) => ({
    minutes, aujourdhui: j, notions: [notion('b', 2, m(0.2, 'fragile'), ['2026-10-14', '2026-10-13'])],
    partiesMaitrise: [{ partie: 5, maitrise: m(0.1, 'fragile') }], partieVeille: null, motsEchus: 20, rejeuxEchus: 20, ...extra,
  });
  it.each(['10', '20', '30'])('budget de %s minutes lu en configuration, ordre cours, mots, rejeu, série', (min) => {
    const s = composerSeance(entree(Number(min)), R);
    const b = R.budgetSeance[min];
    expect(s?.blocs).toEqual([
      { type: 'cours', notionId: 'b', minutes: b.notionMin },
      { type: 'mots', nombre: b.mots },
      { type: 'rejeu', nombre: b.rejeu },
      { type: 'serie', partie: 5, nombre: b.serie },
    ]);
  });
  it('un bloc sans contenu est omis', () => {
    const s = composerSeance(entree(20, { motsEchus: 0, rejeuxEchus: 0 }), R);
    expect(s?.blocs.map((x) => x.type)).toEqual(['cours', 'serie']);
  });
  it('moins d’éléments que le budget : on prend ce qui existe', () => {
    const s = composerSeance(entree(20, { motsEchus: 2 }), R);
    expect(s?.blocs.find((x) => x.type === 'mots')).toEqual({ type: 'mots', nombre: 2 });
  });
  it('« pourquoi » : erreurs sur la notion, sinon le plan', () => {
    expect(composerSeance(entree(20), R)?.pourquoi).toEqual({ type: 'erreurs', notion: 'Notion b', erreurs: 2, motsEchus: 20 });
    const sansErreur = entree(20, { notions: [notion('n', 1, m(null, 'pas_commencee'), [])] });
    expect(composerSeance(sansErreur, R)?.pourquoi).toEqual({ type: 'plan' });
  });
  it('séance sans aucun bloc : null (E-20)', () => {
    expect(composerSeance({ ...entree(20), notions: [], partiesMaitrise: [], motsEchus: 0, rejeuxEchus: 0 }, R)).toBeNull();
  });
  it('durée sans budget : erreur explicite', () => {
    expect(() => composerSeance(entree(15), R)).toThrow('15');
  });
});
