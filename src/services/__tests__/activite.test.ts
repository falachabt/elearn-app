import AsyncStorage from '@react-native-async-storage/async-storage';
import { CLE_ACTIVITES_EN_ATTENTE, enregistrerTempsActivite, lireActivitesJours, synchroniserActivitesEnAttente } from '../activite';

describe('enregistrerTempsActivite & lireActivitesJours', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('enregistre le temps d’une session et cumule par type et matière', async () => {
    const date = new Date('2026-10-11T14:00:00Z');
    await enregistrerTempsActivite({
      type: 'cours',
      matiere: 'Maths',
      titre: 'Dérivation',
      dureeS: 120,
      date,
    });

    await enregistrerTempsActivite({
      type: 'quiz',
      matiere: 'Maths',
      titre: 'Quiz dérivation',
      dureeS: 180,
      date,
    });

    await enregistrerTempsActivite({
      type: 'annale',
      matiere: 'Physique',
      titre: 'Bac 2025',
      dureeS: 600,
      date,
    });

    const jours = await lireActivitesJours();
    const activiteJour = jours['2026-10-11'];
    expect(activiteJour).toBeDefined();
    expect(activiteJour.secondes).toBe(900); // 120 + 180 + 600
    expect(activiteJour.parType.cours).toBe(120);
    expect(activiteJour.parType.quiz).toBe(180);
    expect(activiteJour.parType.annale).toBe(600);
    expect(activiteJour.parMatiere['Maths']).toBe(300);
    expect(activiteJour.parMatiere['Physique']).toBe(600);
    expect(activiteJour.sessions).toHaveLength(3);
  });

  it('enregistre le temps de visionnage vidéo dans le type video (lot 3)', async () => {
    const date = new Date('2026-10-26T07:30:00Z');
    await enregistrerTempsActivite({
      type: 'video',
      matiere: 'Physique',
      titre: 'Partie 1 — La gravitation et le champ',
      dureeS: 185,
      date,
    });

    const jours = await lireActivitesJours();
    const jour = Object.values(jours)[0];
    expect(jour).toBeDefined();
    expect(jour.parType.video).toBe(185);
    expect(jour.sessions).toHaveLength(1);
    expect(jour.sessions[0].type).toBe('video');
  });

  it('envoie les sessions vidéo en attente vers activite_sessions avec le type video', async () => {
    const date = new Date('2026-10-26T07:45:00Z');
    await enregistrerTempsActivite({
      type: 'video',
      matiere: 'Physique',
      titre: 'Partie 2 — Planètes, satellites et énergie',
      dureeS: 240,
      date,
    });
    // Laisser l'envoi d'arrière-plan déclenché par l'enregistrement se terminer.
    await new Promise((r) => setTimeout(r, 0));

    const inserees: Record<string, unknown>[] = [];
    const client = {
      from: (table: string) => ({
        insert: async (ligne: Record<string, unknown>) => {
          expect(table).toBe('activite_sessions');
          inserees.push(ligne);
          return { error: null };
        },
      }),
    };
    await synchroniserActivitesEnAttente(client as never);

    expect(inserees).toHaveLength(1);
    expect(inserees[0].type).toBe('video');
    expect(inserees[0].secondes).toBe(240);
    const reste = await AsyncStorage.getItem(CLE_ACTIVITES_EN_ATTENTE);
    expect(JSON.parse(reste ?? '[]')).toHaveLength(0);
  });

  it('garde la session vidéo en attente si le serveur la refuse (ancien CHECK sans video)', async () => {
    const date = new Date('2026-10-26T08:00:00Z');
    await enregistrerTempsActivite({
      type: 'video',
      matiere: 'Physique',
      titre: 'Partie 3 — Lois de Kepler',
      dureeS: 120,
      date,
    });
    await new Promise((r) => setTimeout(r, 0));

    const client = {
      from: () => ({
        insert: async () => ({ error: { message: 'violates check constraint' } }),
      }),
    };
    await synchroniserActivitesEnAttente(client as never);

    const reste = await AsyncStorage.getItem(CLE_ACTIVITES_EN_ATTENTE);
    const enAttente = JSON.parse(reste ?? '[]') as { type: string }[];
    expect(enAttente).toHaveLength(1);
    expect(enAttente[0].type).toBe('video');
  });

  it('ignore les durées inférieures à 3 secondes', async () => {
    await enregistrerTempsActivite({
      type: 'exercice',
      matiere: 'SVT',
      dureeS: 2,
    });

    const jours = await lireActivitesJours();
    expect(Object.keys(jours)).toHaveLength(0);
  });
});
