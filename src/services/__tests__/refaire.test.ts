import AsyncStorage from '@react-native-async-storage/async-storage';

import { enregistrerCorrection, lireCorrection, statuts } from '../correction';
import { CLE_SESSIONS, enregistrerSession, lireMeilleursScores, lireSessions } from '../entrainement';
import type { QuestionTiree } from '../miniTest';
import { CLE_DERNIER, lireDernierResultat } from '../mission';
import { appliquerRefaire, fusionner } from '../refaire';
import { lireLues } from '../reviser';

const q = (id: string, chapitre = 'Fractions'): QuestionTiree => ({ id, matiere: 'maths', chapitre, enonce: id, choix: ['a', 'b'], bonne: 0 }) as unknown as QuestionTiree;
const Q = [q('q1'), q('q2'), q('q3')];

describe('refaire mes erreurs', () => {
  beforeEach(() => AsyncStorage.clear());

  it('fusionner : une erreur corrigée passe en juste, une erreur encore ratée reste fausse, le reste ne bouge pas', () => {
    const c = fusionner({ source: 'libre', questions: Q, reponses: [0, 1, null] }, { questions: [Q[1], Q[2]], reponses: [0, 1] });
    expect(statuts(c)).toEqual(['juste', 'juste', 'faux']);
  });

  it('sans session d’origine : rien à mettre à jour', async () => {
    expect(await appliquerRefaire({ questions: [Q[0]], reponses: [0] })).toBeNull();
  });

  it('leçon : la session corrigée valide la leçon quand le score passe le seuil', async () => {
    await enregistrerCorrection({ source: 'lecon', questions: Q, reponses: [0, 1, 1], contexte: { type: 'lecon', lecon: 11, cours: 1 } });
    await appliquerRefaire({ questions: [Q[1]], reponses: [0] });
    expect(statuts((await lireCorrection())!)).toEqual(['juste', 'juste', 'faux']);
    expect(await lireLues()).toEqual({ 11: 1 });
  });

  it('mission : score, chapitres et erreurs recalculés, série inchangée', async () => {
    await AsyncStorage.setItem(CLE_DERNIER, JSON.stringify({ niveau: '3e', score: 1, total: 3, dureeS: 60, chapitres: [], jour: '2026-10-01', serie: 4, graceUtilisee: false, erreurs: 2 }));
    await enregistrerCorrection({ source: 'mission', questions: Q, reponses: [0, 1, 1], contexte: { type: 'mission' } });
    await appliquerRefaire({ questions: [Q[1], Q[2]], reponses: [0, 0] });
    expect(await lireDernierResultat()).toMatchObject({ score: 3, total: 3, serie: 4, erreurs: 0, chapitres: [{ chapitre: 'Fractions', bonnes: 3, total: 3 }] });
  });

  it('quiz libre : la session et le meilleur score sont mis à jour', async () => {
    const le = new Date('2026-10-01T10:00:00Z');
    await enregistrerSession('qz1', { questions: Q, reponses: [0, 1, 1] }, le);
    await enregistrerCorrection({ source: 'libre', questions: Q, reponses: [0, 1, 1], contexte: { type: 'libre', quiz: 'qz1', le: le.toISOString() } });
    await appliquerRefaire({ questions: [Q[1], Q[2]], reponses: [0, 0] });
    expect((await lireSessions('qz1'))[0]).toMatchObject({ score: 3, reponses: [0, 0, 0] });
    expect(await lireMeilleursScores()).toEqual({ qz1: 100 });
    expect(JSON.parse((await AsyncStorage.getItem(CLE_SESSIONS))!).qz1).toHaveLength(1);
  });
});
