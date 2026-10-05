import { AppState } from 'react-native';

import type { EtatConnectivite } from '../connectivite';

type EcouteurApp = (s: string) => void;

let app: EcouteurApp | null = null;
let appels = 0;

/** Recharge le service : son état est un singleton de module, chaque test doit repartir de zéro. */
function charger(): typeof import('../connectivite') {
  let module: typeof import('../connectivite') | null = null;
  jest.isolateModules(() => {
    module = jest.requireActual<typeof import('../connectivite')>('../connectivite');
  });
  if (!module) throw new Error('module connectivite introuvable');
  return module;
}

beforeEach(() => {
  app = null;
  appels = 0;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://exemple.test';

  jest.spyOn(AppState, 'addEventListener').mockImplementation(((type: string, ecouteur: EcouteurApp) => {
    if (type === 'change') app = ecouteur;
    return { remove: () => {} };
  }) as never);

  (globalThis as { fetch?: unknown }).fetch = jest.fn(() => {
    appels += 1;
    return Promise.resolve({ ok: true });
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete (globalThis as { fetch?: unknown }).fetch;
});

describe('connectivite : sonde du serveur', () => {
  it('passe hors ligne quand le serveur ne répond pas', async () => {
    const c = charger();
    const arret = c.demarrerConnectivite({ sonderAuDemarrage: false });

    await expect(c.sonder(() => Promise.reject(new Error('serveur muet')))).resolves.toBe(false);
    expect(c.lireConnectivite().backend).toBe(false);
    expect(c.estEnLigne()).toBe(false);
    arret();
  });

  it('repasse en ligne quand le serveur répond de nouveau', async () => {
    const c = charger();
    const arret = c.demarrerConnectivite({ sonderAuDemarrage: false });

    await c.sonder(() => Promise.reject(new Error('serveur muet')));
    await expect(c.sonder(() => Promise.resolve())).resolves.toBe(true);
    expect(c.lireConnectivite().backend).toBe(true);
    expect(c.estEnLigne()).toBe(true);
    arret();
  });

  it('reste optimiste tant qu’aucune sonde n’a abouti', () => {
    const c = charger();
    expect(c.lireConnectivite().backend).toBeNull();
    expect(c.estEnLigne()).toBe(true);
  });

  it('une sonde ratée ne prétend pas que l’interface réseau est absente', async () => {
    const c = charger();
    const arret = c.demarrerConnectivite({ sonderAuDemarrage: false });
    await c.sonder(() => Promise.reject(new Error('serveur muet')));
    // On ne peut pas conclure de l'absence de réponse que l'appareil n'a plus de réseau.
    expect(c.lireConnectivite().internet).toBe(true);
    arret();
  });
});

describe('connectivite : signaux d’une action', () => {
  it('un échec d’action marque hors ligne sans attendre la sonde', () => {
    const c = charger();
    const vus: EtatConnectivite[] = [];
    c.ecouterConnectivite((e) => vus.push(e));

    c.signalerEchec();
    expect(c.lireConnectivite().backend).toBe(false);
    expect(c.estEnLigne()).toBe(false);
    expect(vus).toHaveLength(1);
  });

  it('un succès annule un échec de sonde périmé', async () => {
    const c = charger();
    await c.sonder(() => Promise.reject(new Error('serveur muet')));
    expect(c.estEnLigne()).toBe(false);

    c.signalerSucces();
    expect(c.lireConnectivite().backend).toBe(true);
    expect(c.estEnLigne()).toBe(true);
  });

  it('ne republie pas un état identique', () => {
    const c = charger();
    const vus: EtatConnectivite[] = [];
    c.ecouterConnectivite((e) => vus.push(e));
    c.signalerEchec();
    c.signalerEchec();
    expect(vus).toHaveLength(1);
  });
});

describe('connectivite : reconnaissance des erreurs réseau', () => {
  it('reconnaît les erreurs de transport', () => {
    const c = charger();
    expect(c.estErreurReseau(Object.assign(new Error('Failed to fetch'), { name: 'TypeError' }))).toBe(true);
    expect(c.estErreurReseau(Object.assign(new Error('x'), { name: 'AuthRetryableFetchError' }))).toBe(true);
    expect(c.estErreurReseau(new Error('Network request failed'))).toBe(true);
    expect(c.estErreurReseau(new Error('timeout of 10000ms exceeded'))).toBe(true);
  });

  it('ne confond pas un refus métier avec une panne réseau', () => {
    const c = charger();
    // Un refus du serveur prouve au contraire qu'il répond : ce n'est pas une panne.
    expect(c.estErreurReseau(new Error('solde insuffisant'))).toBe(false);
    expect(c.estErreurReseau(new Error('authentification requise'))).toBe(false);
    expect(c.estErreurReseau(null)).toBe(false);
    expect(c.estErreurReseau(undefined)).toBe(false);
  });
});

describe('connectivite : sondage périodique', () => {
  it('sonde au démarrage puis à intervalle régulier', async () => {
    jest.useFakeTimers();
    const c = charger();
    const arret = c.demarrerConnectivite();

    await Promise.resolve();
    await Promise.resolve();
    expect(appels).toBe(1);

    await jest.advanceTimersByTimeAsync(c.PERIODE_SONDE_MS);
    expect(appels).toBe(2);

    await jest.advanceTimersByTimeAsync(c.PERIODE_SONDE_MS);
    expect(appels).toBe(3);

    arret();
  });

  it('ne relance pas de sonde quand une est déjà en vol', async () => {
    const c = charger();
    const arret = c.demarrerConnectivite({ sonderAuDemarrage: false });

    c.sonderSiBesoin();
    c.sonderSiBesoin();
    c.sonderSiBesoin();
    await Promise.resolve();
    await Promise.resolve();
    expect(appels).toBe(1);

    arret();
  });

  it('arrête le sondage en arrière-plan et le reprend au retour', async () => {
    jest.useFakeTimers();
    const c = charger();
    const arret = c.demarrerConnectivite();
    await Promise.resolve();
    await Promise.resolve();
    const apresDemarrage = appels;

    app?.('background');
    await jest.advanceTimersByTimeAsync(c.PERIODE_SONDE_MS * 3);
    expect(appels).toBe(apresDemarrage);

    app?.('active');
    await Promise.resolve();
    await Promise.resolve();
    expect(appels).toBe(apresDemarrage + 1);

    arret();
  });

  it('arrête tout au démontage', async () => {
    jest.useFakeTimers();
    const c = charger();
    const arret = c.demarrerConnectivite();
    await Promise.resolve();
    await Promise.resolve();
    const apresDemarrage = appels;

    arret();
    await jest.advanceTimersByTimeAsync(c.PERIODE_SONDE_MS * 3);
    expect(appels).toBe(apresDemarrage);
  });
});

describe('connectivite : observation', () => {
  it('prévient les abonnés et se retire proprement', async () => {
    const c = charger();
    const vus: boolean[] = [];
    const desabonner = c.ecouterConnectivite((e) => vus.push(e.backend === true));

    const arret = c.demarrerConnectivite({ sonderAuDemarrage: false });
    await c.sonder(() => Promise.reject(new Error('muet')));
    c.signalerSucces();

    expect(vus).toEqual([false, true]);
    arret();
    desabonner();
  });

  it('le mode test force l’état', () => {
    const c = charger();
    c.definirConnectivitePourTest({ connecte: false, internet: false, backend: false });
    expect(c.estEnLigne()).toBe(false);
    c.definirConnectivitePourTest({ connecte: true, internet: true, backend: true });
    expect(c.estEnLigne()).toBe(true);
  });
});
