import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CLE_PAYS_FERMES,
  chargerPaysFermes,
  estPaysFerme,
  filtrerPaysOuverts,
  lirePaysFermesServeur,
  reinitialiserPaysOuvertsPourTests,
} from '../paysOuverts';

type Client = Parameters<typeof lirePaysFermesServeur>[0];

/** Faux client Supabase : `from('pays_config').select('code').eq('ouvert', false)` résout `resultat`. */
function fauxClient(resultat: Promise<{ data: { code: string }[] | null; error: unknown }>): Client {
  return {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => resultat),
      })),
    })),
  } as unknown as Client;
}

function clientQuiJette(): Client {
  return {
    from: jest.fn(() => {
      throw new Error('table absente');
    }),
  } as unknown as Client;
}

beforeEach(() => {
  reinitialiserPaysOuvertsPourTests();
});

describe('paysOuverts — lecture serveur', () => {
  it('renvoie les pays fermés, en majuscules', async () => {
    const client = fauxClient(Promise.resolve({ data: [{ code: 'sn' }, { code: 'BF' }], error: null }));
    await expect(lirePaysFermesServeur(client)).resolves.toEqual(new Set(['SN', 'BF']));
  });

  it('aucun pays fermé côté serveur : ensemble vide, pas une erreur', async () => {
    const client = fauxClient(Promise.resolve({ data: [], error: null }));
    await expect(lirePaysFermesServeur(client)).resolves.toEqual(new Set());
  });

  it('erreur de lecture : null (repli), jamais d’exception', async () => {
    const client = fauxClient(Promise.resolve({ data: null, error: { message: 'permission refusée' } }));
    await expect(lirePaysFermesServeur(client)).resolves.toBeNull();
  });

  it('client qui lève (table pas encore déployée) : null', async () => {
    await expect(lirePaysFermesServeur(clientQuiJette())).resolves.toBeNull();
  });
});

describe('paysOuverts — chargement et repli', () => {
  it('serveur joignable : pays fermés renvoyés et mis en cache local', async () => {
    const client = fauxClient(Promise.resolve({ data: [{ code: 'SN' }], error: null }));
    await expect(chargerPaysFermes(client)).resolves.toEqual(new Set(['SN']));
    await expect(AsyncStorage.getItem(CLE_PAYS_FERMES)).resolves.toBe(JSON.stringify(['SN']));
  });

  it('serveur en échec sans cache : aucun pays fermé, donc aucun filtrage', async () => {
    const client = fauxClient(Promise.resolve({ data: null, error: { message: 'hors ligne' } }));
    await expect(chargerPaysFermes(client)).resolves.toEqual(new Set());
  });

  it('relancement hors ligne : le cache local garde le pays fermé', async () => {
    const enLigne = fauxClient(Promise.resolve({ data: [{ code: 'SN' }], error: null }));
    await expect(chargerPaysFermes(enLigne)).resolves.toEqual(new Set(['SN']));

    // Nouveau lancement : mémoire vierge, serveur injoignable, mais le cache est toujours là.
    reinitialiserPaysOuvertsPourTests();
    const horsLigne = fauxClient(Promise.resolve({ data: null, error: { message: 'hors ligne' } }));
    await expect(chargerPaysFermes(horsLigne)).resolves.toEqual(new Set(['SN']));
  });

  it('serveur qui rouvre tout : le cache est remplacé, plus aucun pays fermé', async () => {
    const ferme = fauxClient(Promise.resolve({ data: [{ code: 'SN' }], error: null }));
    await chargerPaysFermes(ferme);

    reinitialiserPaysOuvertsPourTests();
    const ouvert = fauxClient(Promise.resolve({ data: [], error: null }));
    await expect(chargerPaysFermes(ouvert)).resolves.toEqual(new Set());
    await expect(AsyncStorage.getItem(CLE_PAYS_FERMES)).resolves.toBe(JSON.stringify([]));
  });
});

describe('paysOuverts — filtrage des listes', () => {
  const liste = [{ alpha2: 'CM' }, { alpha2: 'SN' }, { alpha2: 'GA' }];

  it('retire les pays fermés, garde les autres dans l’ordre', () => {
    expect(filtrerPaysOuverts(liste, new Set(['SN']))).toEqual([{ alpha2: 'CM' }, { alpha2: 'GA' }]);
  });

  it('sans pays fermé, la liste est inchangée', () => {
    expect(filtrerPaysOuverts(liste, new Set())).toEqual(liste);
  });

  it('estPaysFerme : insensible à la casse, jamais vrai sans code', () => {
    const fermes = new Set(['SN']);
    expect(estPaysFerme('sn', fermes)).toBe(true);
    expect(estPaysFerme('CM', fermes)).toBe(false);
    expect(estPaysFerme(null, fermes)).toBe(false);
    expect(estPaysFerme(undefined, fermes)).toBe(false);
  });
});
