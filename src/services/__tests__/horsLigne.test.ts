import AsyncStorage from '@react-native-async-storage/async-storage';

import { ecouterHorsLigne, estimerTelechargement, lancerTelechargement } from '../horsLigne';

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
jest.mock('../connectivite', () => ({ contenuHorsLigneValide: jest.fn(async () => true) }));

import { lireAcces } from '../pass';
import { lireProfil } from '../profil';
import { lireCours, lireLecons, programmeDu } from '../reviser';
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
