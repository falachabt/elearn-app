import { construireParcours, SEUIL_VALIDATION_QUIZ } from '../parcoursSecondaire';
import type { ElementSeance, JourPlanning, Planning } from '../planning';

const lecon = (id: number): ElementSeance => ({ genre: 'lecon', matiere: 'Chimie', cours: 'Structure atomique', lecon: `Leçon ${id}`, minutes: 6, coursId: 1, leconId: id });
const quiz = (id: string): ElementSeance => ({ genre: 'quiz', matiere: 'Chimie', cours: 'Structure atomique', quiz: `Quiz ${id}`, questions: 5, minutes: 4, coursId: 1, quizId: id });
const exo = (id: string): ElementSeance => ({ genre: 'exercice', matiere: 'Chimie', cours: 'Structure atomique', exercice: `Exo ${id}`, minutes: 10, coursId: 1, exerciceId: id });
const jour = (jour: string, elements: ElementSeance[], fait = false): JourPlanning => ({ jour, phase: 'learning', minutes: 30, elements, fait });
const planningDe = (jours: JourPlanning[]): Planning => ({
  statut: 'ready', minutesParJour: 30, cible: null, joursRestants: 100, couverture: { total: 0, prevues: 0 },
  semaines: [{ debut: '2026-11-16', phase: 'learning', jours }],
});

const AUJ = '2026-11-17';

describe('construireParcours', () => {
  it('numérote aujourd’hui puis continue l’aperçu, avec une seule étape courante', () => {
    const p = construireParcours(planningDe([jour(AUJ, [lecon(1), quiz('q1'), exo('e1')]), jour('2026-11-18', [lecon(2)])]), AUJ);
    const [auj, suite] = p.groupes;
    expect(auj.type).toBe('aujourdhui');
    expect(auj.etapes.map((e) => [e.rang, e.etat])).toEqual([[1, 'courante'], [2, 'a_faire'], [3, 'a_faire']]);
    expect(suite.type).toBe('apercu');
    expect(suite.etapes[0]).toMatchObject({ rang: 4, etat: 'apercu' });
    expect(p.courante?.id).toBe(`${AUJ}-0`);
    expect(p.totalAujourdhui).toBe(3);
  });

  it('une leçon validée est faite, la suivante devient courante', () => {
    const p = construireParcours(planningDe([jour(AUJ, [lecon(1), quiz('q1')])]), AUJ, { '1': 1 });
    expect(p.groupes[0].etapes.map((e) => e.etat)).toEqual(['fait', 'courante']);
    expect(p.faitsAujourdhui).toBe(1);
    expect(p.courante?.element).toMatchObject({ genre: 'quiz' });
  });

  it('un quiz sous le seuil est à refaire, au seuil il est validé', () => {
    const sous = construireParcours(planningDe([jour(AUJ, [quiz('q1')])]), AUJ, {}, { scores: { q1: SEUIL_VALIDATION_QUIZ - 20 } });
    expect(sous.groupes[0].etapes[0]).toMatchObject({ etat: 'ratee', score: 60 });
    const ok = construireParcours(planningDe([jour(AUJ, [quiz('q1')])]), AUJ, {}, { scores: { q1: SEUIL_VALIDATION_QUIZ } });
    expect(ok.groupes[0].etapes[0].etat).toBe('fait');
  });

  it('un jour passé non terminé apparaît en rouge, sans rang ; un jour passé terminé disparaît', () => {
    const p = construireParcours(
      planningDe([jour('2026-11-15', [lecon(7)], true), jour('2026-11-16', [lecon(8), quiz('q9')]), jour(AUJ, [lecon(1)])]),
      AUJ,
      { '8': 1 },
    );
    const passe = p.groupes.filter((g) => g.type === 'passe');
    expect(passe).toHaveLength(1);
    expect(passe[0].jour).toBe('2026-11-16');
    expect(passe[0].etapes).toHaveLength(1);
    expect(passe[0].etapes[0]).toMatchObject({ etat: 'ratee', rang: null });
    expect(p.aRefaire).toBe(1);
    // L'étape d'aujourd'hui reste prioritaire pour le bouton.
    expect(p.courante?.id).toBe(`${AUJ}-0`);
  });

  it('journée finie : le bouton propose d’abord ce qui est à refaire, sinon la suite', () => {
    const fini = planningDe([jour('2026-11-16', [quiz('q9')]), jour(AUJ, [lecon(1)]), jour('2026-11-18', [lecon(2)])]);
    expect(construireParcours(fini, AUJ, { '1': 1 }, { scores: { q9: 40 } }).courante).toMatchObject({ jour: '2026-11-16', etat: 'ratee' });
    expect(construireParcours(fini, AUJ, { '1': 1 }, { scores: { q9: 90 } }).courante).toMatchObject({ jour: '2026-11-18', etat: 'apercu' });
  });

  it('séance cochée : toutes ses étapes sont faites et aucune n’est courante', () => {
    const p = construireParcours(planningDe([jour(AUJ, [lecon(1), exo('e1')], true)]), AUJ);
    expect(p.groupes[0].etapes.every((e) => e.etat === 'fait')).toBe(true);
    expect(p.courante).toBeNull();
  });

  it('montre les prochains jours de séance, sans les jours de repos, au-delà de la semaine', () => {
    const jours = [jour(AUJ, [lecon(1)]), jour('2026-11-18', [lecon(2)]), jour('2026-11-19', []), jour('2026-11-20', [lecon(3)]), jour('2026-11-21', [lecon(4)]), jour('2026-11-22', [lecon(5)])];
    const p = construireParcours(planningDe(jours), AUJ);
    expect(p.groupes.filter((g) => g.type === 'apercu').map((g) => g.jour)).toEqual(['2026-11-18', '2026-11-20', '2026-11-21', '2026-11-22']);
  });

  it('sans séance aujourd’hui (repos) : aucun groupe du jour, le bouton vise la prochaine séance', () => {
    const p = construireParcours(planningDe([jour('2026-11-18', [lecon(2)])]), AUJ);
    expect(p.groupes.some((g) => g.type === 'aujourdhui')).toBe(false);
    expect(p.totalAujourdhui).toBe(0);
    expect(p.courante?.jour).toBe('2026-11-18');
  });
});
