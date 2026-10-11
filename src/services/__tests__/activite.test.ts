import AsyncStorage from '@react-native-async-storage/async-storage';
import { enregistrerTempsActivite, lireActivitesJours } from '../activite';

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
