import AsyncStorage from '@react-native-async-storage/async-storage';

import { CLE_ETAT_HORS_LIGNE, concurrenceTelechargement, ecouterHorsLigne, estimerTelechargement, lancerTelechargement, lireEtatHorsLigne, reprendreTelechargementHorsLigne } from '../horsLigne';

/**
 * Prouve que le téléchargement hors ligne est bien scopé au programme actif : il ne prend que les cours renvoyés par
 * `lireCours(programmeDu(profil))`, pas toute la base. `lireCours` est déjà testé (concours vs classe), mais
 * l'estimation qui l'appelle ne l'était pas — c'est ce trou qui laissait un doute sur le périmètre.
 */

jest.mock('../profil', () => ({ lireProfil: jest.fn() }));
jest.mock('../pass', () => ({ lireAcces: jest.fn() }));
jest.mock('../rythme', () => ({ lireRythme: jest.fn(), TAILLE_DEFAUT: 10 }));
jest.mock('../supabase', () => ({ getSupabase: jest.fn(() => ({ rpc: jest.fn(), from: () => ({ select: jest.fn() }) })) }));
jest.mock('../reviser', () => ({
  programmeDu: jest.fn((profil: unknown) => ({ niveau: (profil as { niveau?: string }).niveau ?? '3e', pays: (profil as { pays?: string }).pays ?? 'CM', concours: (profil as { concours?: { id: string } | null }).concours?.id ?? null })),
  lireCours: jest.fn(),
  lireLecons: jest.fn(),
  lireLecon: jest.fn(),
  lireFiche: jest.fn(),
  lireQuizLecon: jest.fn(),
  lireLocalHorsLigne: jest.fn(),
}));
jest.mock('../entrainement', () => ({ lireEntrainement: jest.fn(), lireExercice: jest.fn(), lireQuizLibre: jest.fn() }));
jest.mock('../credits', () => ({ lireOuverts: jest.fn(async () => []) }));
jest.mock('../creditsHorsLigne', () => ({ telechargerContenuPayant: jest.fn(), lireContenuEnCache: jest.fn() }));
jest.mock('../annales', () => ({ lireDossiers: jest.fn(), lireDocuments: jest.fn() }));
jest.mock('../documents', () => ({ prechargerDocument: jest.fn() }));
jest.mock('../mission', () => ({ prechargerMission: jest.fn() }));
jest.mock('../connectivite', () => ({
  contenuHorsLigneValide: jest.fn(async () => true),
  // Même règle que le vrai service : un TypeError ou un message « network » est une erreur réseau.
  estErreurReseau: jest.fn((e: { name?: string; message?: string } | null) =>
    !!e && (e.name === 'TypeError' || /network/i.test(e.message ?? ''))),
}));

import { lireAcces } from '../pass';
import { lireProfil } from '../profil';
import { lireCours, lireLecon, lireLecons, programmeDu } from '../reviser';
import { lireEntrainement } from '../entrainement';
import { lireRythme } from '../rythme';

const mProfil = lireProfil as jest.Mock;
const mAcces = lireAcces as jest.Mock;
const mRythme = lireRythme as jest.Mock;
const mProgramme = programmeDu as jest.Mock;
const mCours = lireCours as jest.Mock;
const mLecons = lireLecons as jest.Mock;
const mEntrainement = lireEntrainement as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  AsyncStorage.clear();
  mProfil.mockResolvedValue({ type: 'concours', niveau: 'ingenieurs', pays: 'CM', concours: { id: 'concours-cible' }, termine: true });
  mAcces.mockResolvedValue({ fin: new Date(Date.now() - 1000).toISOString() }); // pass expiré : pas d'accès illimité
  mRythme.mockResolvedValue(10);
  mProgramme.mockReturnValue({ niveau: 'ingenieurs', pays: 'CM', concours: 'concours-cible' });
  mCours.mockResolvedValue([{ id: 11, nom: 'Analyse', matiere: 'Maths', lecons: 1 }]);
  mLecons.mockResolvedValue([{ id: 101, nom: 'Limites', minutes: 10 }]);
  mEntrainement.mockResolvedValue({ quiz: [{ id: 'q1', nom: 'Quiz 1', numero: 1, questions: 3 }], exercices: [{ id: 'e1', titre: 'Exo', enonce: 'Énoncé' }] });
});

it('télécharge uniquement les cours du programme actif', async () => {
  const est = await estimerTelechargement();

  // Le programme actif est demandé explicitement, puis les cours sont lus AVEC ce programme (jamais sans).
  expect(mProgramme).toHaveBeenCalled();
  expect(mCours).toHaveBeenCalledWith(expect.anything(), { niveau: 'ingenieurs', pays: 'CM', concours: 'concours-cible' });

  // Une seule fiche cours : celle du programme (id 11), pas d'autres cours.
  const tachesCours = est.taches.filter((t) => t.categorie === 'cours');
  const fiches = tachesCours.filter((t) => !t.lecon);
  expect(fiches).toHaveLength(1);
  expect(fiches[0].cours).toBe(11);

  // Les leçons de ce cours seulement.
  const lecons = tachesCours.filter((t) => t.lecon);
  expect(lecons.map((l) => l.lecon)).toEqual([101]);
});

it('ne crée aucune tâche de cours quand le programme n’en a pas', async () => {
  mCours.mockResolvedValue([]);
  const est = await estimerTelechargement();
  expect(est.taches.filter((t) => t.categorie === 'cours')).toHaveLength(0);
  expect(est.taches.filter((t) => t.categorie === 'quiz')).toHaveLength(0);
  expect(est.taches.filter((t) => t.categorie === 'exercices')).toHaveLength(0);
});

// Demande de Benny pendant ses tests de l'issue #74 (23 octobre) : le pack entier (~5 800 éléments) se téléchargeait
// une tâche après l'autre (10 % en cinq minutes), et la mise en veille coupait des éléments en « échec ».
describe('moteur de téléchargement : parallèle et reprise réseau', () => {
  const mLecon = lireLecon as jest.Mock;

  const tachesLecons = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `lecon-${100 + i}`,
      categorie: 'cours' as const,
      statut: 'a-faire' as const,
      cours: 11,
      lecon: 100 + i,
    }));

  const attendreFin = async () => {
    for (let i = 0; i < 300; i++) {
      const statut = (await lireEtatHorsLigne())?.statut;
      if (statut && statut !== 'telechargement') return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('le téléchargement ne s’est pas terminé');
  };

  it('la concurrence grandit avec la quantité restante, sans dépasser le plafond', () => {
    expect(concurrenceTelechargement(0)).toBe(0);
    expect(concurrenceTelechargement(5)).toBeLessThanOrEqual(5);
    expect(concurrenceTelechargement(20)).toBeGreaterThan(1);
    expect(concurrenceTelechargement(500)).toBeGreaterThan(concurrenceTelechargement(20));
    expect(concurrenceTelechargement(6000)).toBeGreaterThan(concurrenceTelechargement(500));
    expect(concurrenceTelechargement(6000)).toBeLessThanOrEqual(16);
  });

  it('plusieurs tâches partent en même temps, toutes arrivent, aucune en échec', async () => {
    let enCours = 0;
    let maximum = 0;
    mLecon.mockImplementation(async () => {
      enCours++;
      maximum = Math.max(maximum, enCours);
      await new Promise((r) => setTimeout(r, 40));
      enCours--;
      return {};
    });
    const estimation = await estimerTelechargement();
    await lancerTelechargement({ ...estimation, taches: tachesLecons(12) });
    await attendreFin();
    const etat = await lireEtatHorsLigne();
    expect(etat?.statut).toBe('termine');
    expect(etat?.taches.every((t) => t.statut === 'faite')).toBe(true);
    expect(maximum).toBeGreaterThanOrEqual(3);
  });

  it('une erreur réseau (veille, coupure) n’est pas un échec : la tâche repart et finit', async () => {
    let appels = 0;
    mLecon.mockImplementation(async () => {
      appels++;
      if (appels <= 2) throw { name: 'TypeError', message: 'Network request failed' };
      return {};
    });
    const estimation = await estimerTelechargement();
    await lancerTelechargement({ ...estimation, taches: tachesLecons(1) });
    await attendreFin();
    const etat = await lireEtatHorsLigne();
    expect(appels).toBe(3);
    expect(etat?.statut).toBe('termine');
    expect(etat?.taches[0].statut).toBe('faite');
  });

  it('une erreur qui n’est pas le réseau reste un échec immédiat, sans réessai', async () => {
    let appels = 0;
    mLecon.mockImplementation(async () => {
      appels++;
      throw new Error('contenu illisible');
    });
    const estimation = await estimerTelechargement();
    await lancerTelechargement({ ...estimation, taches: tachesLecons(1) });
    await attendreFin();
    const etat = await lireEtatHorsLigne();
    expect(appels).toBe(1);
    expect(etat?.statut).toBe('partiel');
    expect(etat?.taches[0].statut).toBe('echec');
  });

  // Benny, même matinée : à la réouverture de l'app, on vérifie ce qui a échoué à cause de la veille ou du réseau —
  // pas complètement téléchargé = on retélécharge ; les vrais échecs (droit, contenu) ne repartent pas tout seuls.
  it('à la reprise, un échec réseau est retéléchargé ; un vrai échec reste en attente', async () => {
    mLecon.mockResolvedValue({});
    const progressionVide = { missions: { total: 0, faites: 0, echecs: 0 }, cours: { total: 3, faites: 1, echecs: 2 }, quiz: { total: 0, faites: 0, echecs: 0 }, exercices: { total: 0, faites: 0, echecs: 0 }, pdf: { total: 0, faites: 0, echecs: 0 } };
    await AsyncStorage.setItem(CLE_ETAT_HORS_LIGNE, JSON.stringify({
      statut: 'partiel',
      profil: { niveau: 'ingenieurs', pays: 'CM', concours: 'concours-cible' },
      taches: [
        { id: 'lecon-100', categorie: 'cours', statut: 'faite', cours: 11, lecon: 100 },
        // Échec laissé par une ancienne version : pas de drapeau, mais le message dit le réseau.
        { id: 'lecon-101', categorie: 'cours', statut: 'echec', cours: 11, lecon: 101, erreur: 'Network request failed' },
        { id: 'lecon-102', categorie: 'cours', statut: 'echec', cours: 11, lecon: 102, erreur: 'corrigé non téléchargé : il n’est pas encore débloqué' },
      ],
      progression: progressionVide,
      estimationOctets: 0,
      espaceDisponible: 0,
      actualiseLe: new Date().toISOString(),
    }));
    await reprendreTelechargementHorsLigne();
    for (let i = 0; i < 100; i++) {
      const e = await lireEtatHorsLigne();
      if (e?.taches.find((t) => t.id === 'lecon-101')?.statut === 'faite') break;
      await new Promise((r) => setTimeout(r, 50));
    }
    const etat = await lireEtatHorsLigne();
    expect(etat?.taches.find((t) => t.id === 'lecon-101')?.statut).toBe('faite');
    expect(etat?.taches.find((t) => t.id === 'lecon-102')?.statut).toBe('echec');
    // Une seule leçon retéléchargée : celle du réseau. Ni celle déjà faite, ni le vrai échec.
    expect(mLecon).toHaveBeenCalledTimes(1);
    expect(mLecon).toHaveBeenCalledWith(expect.anything(), 101);
    expect(etat?.statut).toBe('partiel');
  });
});

describe('progression du téléchargement', () => {
  it('chaque tâche terminée envoie un NOUVEL état aux écouteurs : les barres avancent sans quitter la page', async () => {
    const recus: { ref: unknown; faites: number }[] = [];
    let termine: () => void = () => {};
    const fini = new Promise<void>((resolve) => { termine = resolve; });
    const arreter = ecouterHorsLigne((etat) => {
      if (!etat) return;
      recus.push({ ref: etat, faites: Object.values(etat.progression).reduce((n, p) => n + p.faites, 0) });
      if (etat.statut !== 'telechargement') termine();
    });
    const estimation = await estimerTelechargement();
    await lancerTelechargement({ ...estimation, taches: estimation.taches.filter((t) => t.categorie === 'cours' || t.categorie === 'quiz') });
    await fini;
    arreter();
    // Au moins l'état initial, une mise à jour par tâche, et l'état final.
    expect(recus.length).toBeGreaterThanOrEqual(4);
    // Jamais deux fois la même référence : React ignorerait la seconde et la barre resterait figée.
    expect(new Set(recus.map((r) => r.ref)).size).toBe(recus.length);
    // Et la progression grandit au fil des notifications.
    const faites = recus.map((r) => r.faites);
    expect(faites).toEqual([...faites].sort((a, b) => a - b));
    expect(faites[faites.length - 1]).toBeGreaterThan(faites[0]);
  });
});
