import AsyncStorage from '@react-native-async-storage/async-storage';

import { CLE_PROFIL } from '../../profil';
import { chargerAccueil } from '../accueil';
import { definirApi } from '../api';
import { ecrireDiagnostic, lireDiagnostic, restaurerDiagnostic, type EtatDiagnostic } from '../etat';
import type { Tentative, TentativeListee } from '../types';
import { creerApiFausse } from './apiFausse';

let mockCompteur = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => {
    mockCompteur += 1;
    return `00000000-0000-4000-8000-${String(mockCompteur).padStart(12, '0')}`;
  },
}));

const PER_PART = { '1': { answered: 3, correct: 2 }, '5': { answered: 5, correct: 4 } };

function tentativeDiagnostic(questions: Tentative['questions']): Tentative {
  return {
    attempt_id: 'diag-ancien', kind: 'diagnostic', part: null, length: questions.length, status: 'finished',
    started_at: '2026-10-20T10:00:00.000Z', credits_spent: 0, questions, replay: false,
  };
}

function ligneDiagnostic(questions: Tentative['questions']): TentativeListee {
  return {
    id: 'diag-ancien', kind: 'diagnostic', part: null, length: questions.length, status: 'finished',
    score: 745, scoreMin: 720, scoreMax: 770, startedAt: '2026-10-20T10:00:00.000Z', finishedAt: '2026-10-20T10:15:00.000Z',
    perPart: PER_PART, timePerPart: null, creditsSpent: 0, refunded: false, questions: questions.map((q) => q.id),
  };
}

/** Monde d'un élève qui a terminé son diagnostic sur le serveur (historique + tentative relisible). */
function mondeAvecDiagnosticTermine() {
  const faux = creerApiFausse();
  const tentative = tentativeDiagnostic(faux.questions);
  const avecDiag = creerApiFausse({ tentatives: [ligneDiagnostic(faux.questions)], tentativeParId: { 'diag-ancien': tentative } });
  return avecDiag;
}

beforeEach(async () => {
  mockCompteur = 0;
  await AsyncStorage.clear();
});
afterEach(() => definirApi(null));

describe('restauration du diagnostic après reconnexion', () => {
  it('reconnexion : état local effacé (déconnexion) mais diagnostic terminé côté serveur → état restauré et persisté', async () => {
    const { api } = mondeAvecDiagnosticTermine();
    definirApi(api);
    // L'appareil ne garde rien : c'est l'état après déconnexion puis reconnexion au même compte.
    expect(await lireDiagnostic()).toBeNull();

    const etat = await restaurerDiagnostic('toeic');

    expect(etat?.termine).toBe(true);
    expect(etat?.tentative?.attempt_id).toBe('diag-ancien');
    expect(etat?.fin).toMatchObject({ status: 'finished', attempt_id: 'diag-ancien', kind: 'diagnostic', estimated: true, score: 745, score_min: 720, score_max: 770, per_part: PER_PART });
    // Persisté : les lectures suivantes (barre d'onglets, reprise) le retrouvent sans rappeler le serveur.
    const relu = await lireDiagnostic();
    expect(relu?.fin?.attempt_id).toBe('diag-ancien');
  });

  it('reconnexion : l’accueil reconnaît le diagnostic fait et affiche le score estimé du serveur', async () => {
    const { api } = mondeAvecDiagnosticTermine();
    definirApi(api);
    await AsyncStorage.setItem(CLE_PROFIL, JSON.stringify({ type: 'certification', exam: 'toeic', termine: true }));

    const donnees = await chargerAccueil();

    expect(donnees.diagnosticFait).toBe(true);
    expect(donnees.score).toBe(745);
  });

  it('nouvel arrivant : aucun diagnostic côté serveur → rien n’est restauré, l’accueil reste au premier pas', async () => {
    const { api } = creerApiFausse({ tentatives: [] });
    definirApi(api);
    await AsyncStorage.setItem(CLE_PROFIL, JSON.stringify({ type: 'certification', exam: 'toeic', termine: true }));

    await expect(restaurerDiagnostic('toeic')).resolves.toBeNull();
    expect(await lireDiagnostic()).toBeNull();

    const donnees = await chargerAccueil();
    expect(donnees.diagnosticFait).toBe(false);
    expect(donnees.score).toBeNull();
  });

  it('diagnostic déjà sur l’appareil : aucun appel serveur, l’état local fait foi', async () => {
    const { api } = mondeAvecDiagnosticTermine();
    definirApi(api);
    const espion = jest.spyOn(api, 'listerTentatives');
    const local: EtatDiagnostic = {
      clientUuid: 'uuid-local', tentative: null, reponses: [], index: 0, termine: true,
      fin: { status: 'finished', attempt_id: 'diag-local', kind: 'diagnostic', estimated: true, score: 700, score_min: 680, score_max: 720, per_part: {}, results: [], replay: false },
    };
    await ecrireDiagnostic(local);

    const etat = await restaurerDiagnostic('toeic');

    expect(etat?.fin?.attempt_id).toBe('diag-local');
    expect(espion).not.toHaveBeenCalled();
  });

  it('diagnostic en cours sur l’appareil : jamais écrasé par la restauration', async () => {
    const { api } = mondeAvecDiagnosticTermine();
    definirApi(api);
    const espion = jest.spyOn(api, 'listerTentatives');
    const enCours: EtatDiagnostic = { clientUuid: 'uuid-encours', tentative: tentativeDiagnostic(creerApiFausse().questions), reponses: [], index: 3, termine: false, fin: null };
    await ecrireDiagnostic(enCours);

    const etat = await restaurerDiagnostic('toeic');

    expect(etat?.clientUuid).toBe('uuid-encours');
    expect(etat?.fin).toBeNull();
    expect(espion).not.toHaveBeenCalled();
  });

  it('hors ligne : le serveur ne répond pas → rien n’est écrit, aucune erreur, le premier pas reste', async () => {
    const { api } = creerApiFausse({ tentatives: 'echec' });
    definirApi(api);

    await expect(restaurerDiagnostic('toeic')).resolves.toBeNull();
    expect(await lireDiagnostic()).toBeNull();
  });

  it('tentative relue incohérente (pas un diagnostic) : rien n’est écrit', async () => {
    const faux = creerApiFausse();
    const mini: Tentative = { ...tentativeDiagnostic(faux.questions), kind: 'mini' };
    const { api } = creerApiFausse({ tentatives: [ligneDiagnostic(faux.questions)], tentativeParId: { 'diag-ancien': mini } });
    definirApi(api);

    await expect(restaurerDiagnostic('toeic')).resolves.toBeNull();
    expect(await lireDiagnostic()).toBeNull();
  });

  it('diagnostic terminé sans estimation (anciens résultats) : restauré, estimé à faux, aucun score fabriqué', async () => {
    const faux = creerApiFausse();
    const ligne: TentativeListee = { ...ligneDiagnostic(faux.questions), score: null, scoreMin: null, scoreMax: null };
    const { api } = creerApiFausse({ tentatives: [ligne], tentativeParId: { 'diag-ancien': tentativeDiagnostic(faux.questions) } });
    definirApi(api);

    const etat = await restaurerDiagnostic('toeic');

    expect(etat?.fin).toMatchObject({ estimated: false, score: null, score_min: null, score_max: null });
  });
});
