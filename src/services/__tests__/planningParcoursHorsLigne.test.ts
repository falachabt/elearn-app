import AsyncStorage from '@react-native-async-storage/async-storage';

import { definirConnectivitePourTest } from '../connectivite';
import {
  basculerSeance,
  CLE_COPIE_PLANNING,
  lireCochesEnAttente,
  lirePlanning,
  seanceDe,
} from '../planning';

jest.mock('../connectivite', () => ({
  ...jest.requireActual('../connectivite'),
  signalerEchec: jest.fn(),
  signalerSucces: jest.fn(),
}));

/**
 * Parcours complet du planning hors ligne (issue #74, lot D) : lecture en ligne, coupure, travail sur la
 * copie, coches en file, reconnexion et rejeu — les vrais services (planning, connectivité, stockage
 * local) bout à bout, seul le client Supabase est remplacé par un faux serveur à l'état explicite.
 */

const JOUR = '2026-10-19';
const UTILISATEUR = 'u-parcours';

function fauxServeur() {
  const etat = {
    joignable: true,
    coches: new Map<string, boolean>(),
    appels: [] as { nom: string; params?: Record<string, unknown> }[],
  };
  const reponsePlanning = () => ({
    status: 'ready',
    minutes_per_day: 45,
    rest_days_per_week: 2,
    reminder_time: '18:30',
    subjects: ['Mathématique'],
    content_types: ['lesson'],
    target: { type: 'examen', label: 'Baccalauréat', date: '2027-06-23', status: 'reprise' },
    days_left: 247,
    coverage: { lessons_total: 1, lessons_scheduled: 1 },
    weeks: [
      {
        start: JOUR,
        phase: 'learning',
        days: [
          {
            day: JOUR,
            phase: 'learning',
            minutes: 45,
            items: [{ kind: 'lesson', course_id: 1, course: 'Fractions', subject: 'Mathématique', lesson_id: 2, lesson: 'Définition', minutes: 20 }],
            done: etat.coches.get(JOUR) ?? false,
          },
        ],
      },
    ],
  });
  const client = {
    rpc: jest.fn(async (nom: string, params?: Record<string, unknown>) => {
      etat.appels.push({ nom, params });
      if (!etat.joignable) throw new Error('Network request failed');
      if (nom === 'my_study_plan') return { data: reponsePlanning(), error: null };
      if (nom === 'study_plan_mark_done') {
        etat.coches.set(String(params?.p_day), params?.p_done === true);
        return { data: true, error: null };
      }
      return { data: null, error: null };
    }),
  };
  return { client, etat };
}

const enLigne = () => definirConnectivitePourTest({ connecte: true, internet: true, backend: true, enVerification: false });
const horsLigne = () => definirConnectivitePourTest({ connecte: false, internet: false, backend: false, enVerification: false });

beforeEach(async () => {
  await AsyncStorage.clear();
  enLigne();
});

describe('parcours planning : en ligne, hors ligne, reconnexion', () => {
  it('la copie prend le relais pendant la coupure, les coches partent en file et sont rejouées au retour du réseau', async () => {
    const { client, etat } = fauxServeur();

    // 1. En ligne : le planning vient du serveur et sa copie est gardée sur l'appareil.
    const lecture1 = await lirePlanning(client as never, UTILISATEUR);
    expect(lecture1.copie).toBe(false);
    expect(lecture1.planning.statut).toBe('ready');
    expect(seanceDe(lecture1.planning, JOUR)?.fait).toBe(false);
    expect(await AsyncStorage.getItem(CLE_COPIE_PLANNING(UTILISATEUR))).not.toBeNull();

    // 2. Coupure : le même planning ressort de la copie, sans attendre le serveur.
    etat.joignable = false;
    horsLigne();
    const lecture2 = await lirePlanning(client as never, UTILISATEUR);
    expect(lecture2.copie).toBe(true);
    expect(seanceDe(lecture2.planning, JOUR)?.elements).toHaveLength(1);

    // 3. Hors ligne : la coche ne part pas au serveur, elle est rangée dans la file de l'élève…
    await expect(basculerSeance(client as never, UTILISATEUR, JOUR, true)).resolves.toBe('enAttente');
    expect(etat.coches.get(JOUR)).toBeUndefined();
    expect(await lireCochesEnAttente(UTILISATEUR)).toMatchObject([{ jour: JOUR, fait: true }]);

    // …et elle est visible tout de suite sur la copie affichée.
    const lecture3 = await lirePlanning(client as never, UTILISATEUR);
    expect(lecture3.copie).toBe(true);
    expect(seanceDe(lecture3.planning, JOUR)?.fait).toBe(true);

    // 4. Reconnexion : la lecture rejoue d'abord la file (le serveur reçoit la coche), puis lit l'état à jour.
    etat.joignable = true;
    enLigne();
    etat.appels.length = 0;
    const lecture4 = await lirePlanning(client as never, UTILISATEUR);
    expect(etat.appels.map((a) => a.nom)).toEqual(['study_plan_mark_done', 'my_study_plan']);
    expect(etat.appels[0].params).toMatchObject({ p_day: JOUR, p_done: true });
    expect(etat.coches.get(JOUR)).toBe(true);
    expect(await lireCochesEnAttente(UTILISATEUR)).toEqual([]);
    expect(lecture4.copie).toBe(false);
    expect(seanceDe(lecture4.planning, JOUR)?.fait).toBe(true);
  });

  it('en ligne, la coche part directement au serveur et ne laisse rien dans la file', async () => {
    const { client, etat } = fauxServeur();
    await lirePlanning(client as never, UTILISATEUR);
    await expect(basculerSeance(client as never, UTILISATEUR, JOUR, true)).resolves.toBe('serveur');
    expect(etat.coches.get(JOUR)).toBe(true);
    expect(await lireCochesEnAttente(UTILISATEUR)).toEqual([]);
  });

  it('sans copie gardée, la coupure remonte l’erreur réseau : l’écran affiche son état « pas de réseau »', async () => {
    const { client, etat } = fauxServeur();
    etat.joignable = false;
    horsLigne();
    await expect(lirePlanning(client as never, UTILISATEUR)).rejects.toThrow('Network request failed');
    expect(await lireCochesEnAttente(UTILISATEUR)).toEqual([]);
  });
});
