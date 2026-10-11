import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Solde } from '../credits';
import {
  ajouterDepenseEnAttente,
  cleCache,
  contenuPaye,
  deciderDepenseHorsLigne,
  depenserAvecRepli,
  enregistrerContenuEnCache,
  garderSoldeLocal,
  identifiantOperation,
  lireContenuEnCache,
  lireContenuEnCacheValide,
  lireDepensesEnAttente,
  lireSoldeLocal,
  oublierContenuEnCache,
  repartirRejeu,
  retirerDepensesEnAttente,
  soldeDebite,
  synchroniserDepensesHorsLigne,
  telechargerContenuPayant,
  type OperationHorsLigne,
} from '../creditsHorsLigne';

jest.mock('../connectivite', () => ({
  estEnLigne: jest.fn(() => true),
  estErreurReseau: jest.fn(() => false),
  DUREE_VALIDITE_HORS_LIGNE_MS: 7 * 24 * 3600 * 1000,
}));

const { estEnLigne, estErreurReseau } = jest.requireMock('../connectivite') as { estEnLigne: jest.Mock; estErreurReseau: jest.Mock };

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
  estEnLigne.mockReturnValue(true);
  estErreurReseau.mockReturnValue(false);
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

  it('ne sert pas un contenu périmé et le retire', async () => {
    const JOUR = 24 * 3600 * 1000;
    const maintenant = Date.UTC(2026, 9, 20, 12);
    // Contenu rangé il y a plus de 7 jours : il ne doit plus être servi, et doit libérer l'espace.
    await AsyncStorage.setItem(
      cleCache('exercise_solution', 'ex-vieux'),
      JSON.stringify({ contenu: { correction: 'x' }, le: new Date(maintenant - 8 * JOUR).toISOString() }),
    );
    const lu = await AsyncStorage.getItem(cleCache('exercise_solution', 'ex-vieux'));
    expect(lu).not.toBeNull();

    expect(await lireContenuEnCacheValide('exercise_solution', 'ex-vieux', maintenant)).toBeNull();
    // Retiré au passage : il ne réapparaîtra pas au prochain essai.
    expect(await AsyncStorage.getItem(cleCache('exercise_solution', 'ex-vieux'))).toBeNull();
  });

  it('sert un contenu encore valable', async () => {
    const JOUR = 24 * 3600 * 1000;
    const maintenant = Date.UTC(2026, 9, 20, 12);
    await enregistrerContenuEnCache('exercise_solution', 'ex-neuf', { correction: 'ok' }, new Date(maintenant - 2 * JOUR));
    expect(await lireContenuEnCacheValide('exercise_solution', 'ex-neuf', maintenant)).toEqual({ correction: 'ok' });
  });
});

describe('credits hors ligne : contenu telecharge mais non paye (option A)', () => {
  const clientTelechargement = (contenu: unknown) => ({ rpc: jest.fn(async () => ({ data: contenu, error: null })) }) as never;

  it('le telechargement ne debite RIEN et verrouille le contenu', async () => {
    const client = clientTelechargement({ correction_compressed: 'H4sIcorr' });
    await telechargerContenuPayant(client, 'exercise_solution', 'ex-1');

    // Le contenu est bien range…
    expect(await lireContenuEnCache('exercise_solution', 'ex-1')).toEqual({ correction_compressed: 'H4sIcorr' });
    // …mais marque NON paye : c'est ce qui le verrouille.
    expect(await contenuPaye('exercise_solution', 'ex-1')).toBe(false);
  });

  it('un contenu non paye ne s’affiche pas sans solde suffisant', async () => {
    const client = clientTelechargement({ correction: 'x' });
    await telechargerContenuPayant(client, 'exercise_solution', 'ex-1');
    // La requête échoue pour cause de réseau : c'est ce qui autorise le repli hors ligne.
    estErreurReseau.mockReturnValue(true);

    const r = await depenserAvecRepli({
      client: { rpc: jest.fn(async () => Promise.reject(new Error('Network request failed'))) } as never,
      utilisateur: 'u1',
      soldeLocal: { ...SOLDE, total: 1 },
      cout: 2,
      action: 'exercise_solution',
      objet: 'ex-1',
      operationId: 'op-uuid-1',
    });

    expect(r.statut).toBe('insufficient');
    expect(r.contenu).toBeNull();
    // Toujours verrouille : rien n'a ete debite.
    expect(await contenuPaye('exercise_solution', 'ex-1')).toBe(false);
    estErreurReseau.mockReturnValue(false);
  });

  it('un contenu non paye s’ouvre apres debit local, et devient lisible', async () => {
    const client = clientTelechargement({ correction: 'la reponse' });
    await telechargerContenuPayant(client, 'exercise_solution', 'ex-1');
    estEnLigne.mockReturnValue(false);

    const r = await depenserAvecRepli({
      client: { rpc: jest.fn() } as never,
      utilisateur: 'u1',
      soldeLocal: SOLDE,
      cout: 2,
      action: 'exercise_solution',
      objet: 'ex-1',
      operationId: 'op-uuid-2',
    });

    expect(r.statut).toBe('spent');
    expect(r.contenu).toEqual({ correction: 'la reponse' });
    expect(r.solde).toBe(18);
    // Le credit est consomme localement : le contenu est desormais lisible.
    expect(await contenuPaye('exercise_solution', 'ex-1')).toBe(true);
    // Et l'operation attend la reconnexion.
    expect(await lireDepensesEnAttente('u1')).toHaveLength(1);
    estEnLigne.mockReturnValue(true);
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
    await ajouterDepenseEnAttente('u1', { id: 'op1', operationId: 'op-uuid-1', action: 'exercise_solution', objet: 'ex-1', cout: 5, le: new Date().toISOString() });
    const garde = await garderSoldeLocal('u1', SOLDE);
    expect(garde.confirme).toBe(false);
  });
});

describe('credits hors ligne : file des opérations', () => {
  const operation = (id: string, objet = 'ex-1'): OperationHorsLigne => ({
    id,
    operationId: `uuid-${id}`,
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

  it('garde deux consultations du même justificatif de quiz', async () => {
    // `quiz_explanation` est facturée à CHAQUE consultation : deux consultations légitimes doivent produire deux
    // opérations. Dédupliquer sur (action, objet) en perdait une, donc un crédit n'était jamais débité.
    const quiz = (id: string): OperationHorsLigne => ({ id, operationId: `uuid-${id}`, action: 'quiz_explanation', objet: '970001', cout: 1, le: new Date().toISOString() });
    await ajouterDepenseEnAttente('u1', quiz('op1'));
    await ajouterDepenseEnAttente('u1', quiz('op2'));
    expect(await lireDepensesEnAttente('u1')).toHaveLength(2);
  });

  it('n’empile pas deux fois la même opération', async () => {
    // Même identifiant = même opération : la rejouer deux fois serait un double débit.
    await ajouterDepenseEnAttente('u1', operation('op1'));
    await ajouterDepenseEnAttente('u1', operation('op1'));
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

  it('un rejeu reconnu par le serveur confirme sans nouveau débit', () => {
    const r = repartirRejeu([{ id: 'op1', statut: 'replay', solde: 20, confirme: true }]);
    expect(r.confirmees).toEqual(['op1']);
    expect(r.confirme).toBe(true);
  });
});

describe('credits hors ligne : identifiant d’opération envoyé au serveur', () => {
  /** Client factice : renvoie la réponse donnée et retient les arguments de chaque appel RPC. */
  function clientFaux(reponse: { status: string; cost: number; balance: number; content: unknown }) {
    const rpc = jest.fn(() => Promise.resolve({ data: [reponse], error: null }));
    return { client: { rpc } as never, rpc };
  }

  it('en ligne, l’identifiant part avec la dépense (c’est lui qui protège du double débit)', async () => {
    const { client, rpc } = clientFaux({ status: 'spent', cost: 2, balance: 18, content: { correction: 'x' } });

    const r = await depenserAvecRepli({
      client,
      utilisateur: 'u1',
      soldeLocal: SOLDE,
      cout: 2,
      action: 'exercise_solution',
      objet: 'ex-1',
      operationId: 'op-uuid-1',
    });

    expect(r.statut).toBe('spent');
    expect(rpc).toHaveBeenCalledWith('depenser_credits', { p_action: 'exercise_solution', p_ref: 'ex-1', p_operation: 'op-uuid-1' });
  });

  it('un échec réseau met en file la MÊME opération, avec le même identifiant', async () => {
    // C'est l'invariant central : si le rejeu portait un autre identifiant, le serveur ne reconnaîtrait pas
    // l'opération et débiterait une seconde fois (le cas de `quiz_explanation`, facturée à chaque appel).
    const rpc = jest.fn(() => Promise.reject(new Error('Network request failed')));
    estErreurReseau.mockReturnValue(true);
    await enregistrerContenuEnCache('exercise_solution', 'ex-1', { correction: 'x' });

    const r = await depenserAvecRepli({
      client: { rpc } as never,
      utilisateur: 'u1',
      soldeLocal: SOLDE,
      cout: 2,
      action: 'exercise_solution',
      objet: 'ex-1',
      operationId: 'op-uuid-1',
    });

    expect(r.statut).toBe('spent');
    const file = await lireDepensesEnAttente('u1');
    expect(file).toHaveLength(1);
    expect(file[0].operationId).toBe('op-uuid-1');
  });

  it('le rejeu transmet l’identifiant enregistré', async () => {
    await AsyncStorage.setItem(
      'credits.depensesEnAttente.u1',
      JSON.stringify([{ id: 'op1', operationId: 'op-uuid-9', action: 'quiz_explanation', objet: '970001', cout: 1, le: '2026-10-05T10:00:00.000Z' }]),
    );
    const { client, rpc } = clientFaux({ status: 'replay', cost: 1, balance: 19, content: { explanation: 'Parce que.' } });

    const r = await synchroniserDepensesHorsLigne({ client, utilisateur: 'u1', soldeLocal: SOLDE });

    expect(rpc).toHaveBeenCalledWith('depenser_credits', { p_action: 'quiz_explanation', p_ref: '970001', p_operation: 'op-uuid-9' });
    expect(r.confirme).toBe(true);
    expect(r.restantes).toBe(0);
    expect(r.solde?.total).toBe(19);
  });

  it('une opération sans identifiant n’est pas rejouée avec un identifiant inventé', async () => {
    // Opération héritée d'une version antérieure : mieux vaut ne pas envoyer `p_operation` qu'un identifiant
    // nouveau, qui ferait passer un rejeu pour une dépense neuve.
    await AsyncStorage.setItem(
      'credits.depensesEnAttente.u1',
      JSON.stringify([{ id: 'op1', action: 'exercise_solution', objet: 'ex-1', cout: 2, le: '2026-10-05T10:00:00.000Z' }]),
    );
    const { client, rpc } = clientFaux({ status: 'already', cost: 0, balance: 20, content: null });

    await synchroniserDepensesHorsLigne({ client, utilisateur: 'u1', soldeLocal: SOLDE });

    expect(rpc).toHaveBeenCalledWith('depenser_credits', { p_action: 'exercise_solution', p_ref: 'ex-1', p_operation: null });
  });
});
