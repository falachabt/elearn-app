import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Solde } from '../credits';
import {
  ajouterDepenseEnAttente,
  cleCache,
  deciderDepenseHorsLigne,
  enregistrerContenuEnCache,
  garderSoldeLocal,
  identifiantOperation,
  lireContenuEnCache,
  lireDepensesEnAttente,
  lireSoldeLocal,
  oublierContenuEnCache,
  repartirRejeu,
  retirerDepensesEnAttente,
  soldeDebite,
  type OperationHorsLigne,
} from '../creditsHorsLigne';

const SOLDE: Solde = {
  total: 20,
  semaine: 12,
  recompenses: 8,
  recharge: 25,
  prochaineRecharge: '2026-10-12T00:00:00Z',
  rechargeHebdo: true,
  illimite: false,
  illimiteJusqua: null,
  expirationRecompenses: null,
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('credits hors ligne : décision de dépense', () => {
  it('débite le solde local quand le contenu est en cache et le solde suffisant', () => {
    const r = deciderDepenseHorsLigne({ solde: 20, cout: 5, contenuEnCache: { correction: 'x' } });
    expect(r.statut).toBe('spent');
    expect(r.solde).toBe(15);
    expect(r.enAttente).toBe(true);
    expect(r.contenu).toEqual({ correction: 'x' });
  });

  it('refuse quand le solde connu est insuffisant', () => {
    const r = deciderDepenseHorsLigne({ solde: 2, cout: 5, contenuEnCache: { correction: 'x' } });
    expect(r.statut).toBe('insufficient');
    expect(r.solde).toBe(2);
    expect(r.contenu).toBeNull();
    expect(r.enAttente).toBe(false);
  });

  it('refuse quand le contenu n’est pas sur l’appareil, même avec du solde', () => {
    // Sans réseau, le serveur renvoie le contenu : sans copie locale il n'y a rien à afficher.
    const r = deciderDepenseHorsLigne({ solde: 50, cout: 5, contenuEnCache: null });
    expect(r.statut).toBe('insufficient');
    expect(r.contenu).toBeNull();
    expect(r.enAttente).toBe(false);
  });

  it('ne débite rien avec un pass illimité', () => {
    const r = deciderDepenseHorsLigne({ solde: 20, cout: 5, contenuEnCache: { correction: 'x' }, illimite: true });
    expect(r.statut).toBe('unlimited');
    expect(r.solde).toBe(20);
    expect(r.cout).toBe(0);
  });

  it('le solde local ne descend jamais sous zéro', () => {
    expect(soldeDebite({ ...SOLDE, total: 3 }, 5).total).toBe(0);
    expect(soldeDebite(SOLDE, 5).total).toBe(15);
  });
});

describe('credits hors ligne : solution gardée localement', () => {
  it('range et relit un contenu, puis l’oublie', async () => {
    await enregistrerContenuEnCache('exercise_solution', 'ex-1', { correction: 'la reponse' });
    expect(await lireContenuEnCache('exercise_solution', 'ex-1')).toEqual({ correction: 'la reponse' });

    await oublierContenuEnCache('exercise_solution', 'ex-1');
    expect(await lireContenuEnCache('exercise_solution', 'ex-1')).toBeNull();
  });

  it('sépare les contenus par action et par référence', async () => {
    await enregistrerContenuEnCache('exercise_solution', 'ex-1', { a: 1 });
    await enregistrerContenuEnCache('document_pdf', 'ex-1', { url: 'https://exemple.test/d.pdf' });
    expect(await lireContenuEnCache('exercise_solution', 'ex-1')).toEqual({ a: 1 });
    expect(await lireContenuEnCache('document_pdf', 'ex-1')).toEqual({ url: 'https://exemple.test/d.pdf' });
    expect(await lireContenuEnCache('exam_correction', 'ex-1')).toBeNull();
    expect(cleCache('document_pdf', 'ex-1')).toContain('document_pdf');
  });

  it('ne relit pas un contenu corrompu', async () => {
    await AsyncStorage.setItem(cleCache('exercise_solution', 'ex-1'), 'pas du json');
    expect(await lireContenuEnCache('exercise_solution', 'ex-1')).toBeNull();
  });
});

describe('credits hors ligne : solde local', () => {
  it('garde le solde confirmé du serveur', async () => {
    const garde = await garderSoldeLocal('u1', SOLDE);
    expect(garde.confirme).toBe(true);
    expect(await lireSoldeLocal('u1')).toMatchObject({ pour: 'u1', confirme: true });
  });

  it('ne rend pas le solde d’un autre compte', async () => {
    await garderSoldeLocal('u1', SOLDE);
    expect(await lireSoldeLocal('u2')).toBeNull();
  });

  it('marque le solde non confirmé quand une dépense attend', async () => {
    await ajouterDepenseEnAttente('u1', { id: 'op1', action: 'exercise_solution', objet: 'ex-1', cout: 5, le: new Date().toISOString() });
    const garde = await garderSoldeLocal('u1', SOLDE);
    expect(garde.confirme).toBe(false);
  });
});

describe('credits hors ligne : file des opérations', () => {
  const operation = (id: string, objet = 'ex-1'): OperationHorsLigne => ({
    id,
    action: 'exercise_solution',
    objet,
    cout: 5,
    le: new Date().toISOString(),
  });

  it('ajoute les opérations dans l’ordre', async () => {
    await ajouterDepenseEnAttente('u1', operation('op1'));
    await ajouterDepenseEnAttente('u1', operation('op2', 'ex-2'));
    const file = await lireDepensesEnAttente('u1');
    expect(file.map((o) => o.id)).toEqual(['op1', 'op2']);
  });

  it('n’empile pas deux fois le même contenu', async () => {
    // Deux dépenses du même contenu seraient un double débit au rejeu.
    await ajouterDepenseEnAttente('u1', operation('op1'));
    await ajouterDepenseEnAttente('u1', operation('op2'));
    expect(await lireDepensesEnAttente('u1')).toHaveLength(1);
  });

  it('sépare les files par compte', async () => {
    await ajouterDepenseEnAttente('u1', operation('op1'));
    expect(await lireDepensesEnAttente('u2')).toHaveLength(0);
  });

  it('retire les opérations confirmées', async () => {
    await ajouterDepenseEnAttente('u1', operation('op1'));
    await ajouterDepenseEnAttente('u1', operation('op2', 'ex-2'));
    const restantes = await retirerDepensesEnAttente('u1', ['op1']);
    expect(restantes.map((o) => o.id)).toEqual(['op2']);
    expect(await lireDepensesEnAttente('u1')).toHaveLength(1);
  });

  it('vide la file quand tout est retiré', async () => {
    await ajouterDepenseEnAttente('u1', operation('op1'));
    await retirerDepensesEnAttente('u1', ['op1']);
    expect(await AsyncStorage.getItem('credits.depensesEnAttente.u1')).toBeNull();
  });

  it('identifie une opération de façon stable', () => {
    expect(identifiantOperation('exercise_solution', 'ex-1', 1000)).toBe('exercise_solution:ex-1:1000');
    expect(identifiantOperation('document_pdf', 42, 1000)).toBe('document_pdf:42:1000');
  });
});

describe('credits hors ligne : rejeu à la reconnexion', () => {
  it('confirme tout quand le serveur a répondu à chaque opération', () => {
    const r = repartirRejeu([
      { id: 'op1', statut: 'spent', solde: 15, confirme: true },
      { id: 'op2', statut: 'already', solde: 15, confirme: true },
    ]);
    expect(r.confirmees).toEqual(['op1', 'op2']);
    expect(r.confirme).toBe(true);
    expect(r.restantes).toBe(0);
  });

  it('garde en file une opération qui a échoué et ne confirme pas le solde', () => {
    const r = repartirRejeu([
      { id: 'op1', statut: 'spent', solde: 15, confirme: true },
      { id: 'op2', statut: 'spent', solde: 15, confirme: false },
    ]);
    expect(r.confirmees).toEqual(['op1']);
    expect(r.restantes).toBe(1);
    expect(r.confirme).toBe(false);
  });

  it('un rejeu qui répond « déjà » ne débite pas une seconde fois', () => {
    // Le serveur renvoie `already` quand le contenu était déjà débloqué : le solde ne bouge plus.
    const r = repartirRejeu([{ id: 'op1', statut: 'already', solde: 20, confirme: true }]);
    expect(r.confirme).toBe(true);
  });
});
