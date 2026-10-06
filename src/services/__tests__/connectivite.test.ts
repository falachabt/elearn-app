import { AppState } from 'react-native';

import type { EtatConnectivite } from '../connectivite';

// Aucun mock de `expo-modules-core` : le preset Jest d'Expo fournit déjà `ExpoNetwork` comme module mocké (avec
// `addListener`), ce qui suffit à piloter les évènements réseau. Remplacer tout `expo-modules-core` casserait les
// autres paquets natifs (expo-linking, expo-secure-store).

type EcouteurApp = (s: string) => void;
type EcouteurReseau = (e: { isConnected?: boolean; isInternetReachable?: boolean }) => void;

let app: EcouteurApp | null = null;
let reseau: EcouteurReseau | null = null;
let retires = 0;
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

/**
 * Le preset d'Expo fournit `ExpoNetwork` comme module mocké. On remplace son `addListener` pour capturer l'écouteur
 * enregistré par le service, et pour compter les retraits.
 */
function avecModuleReseau() {
  const core = jest.requireActual('expo-modules-core') as { requireOptionalNativeModule: (nom: string) => unknown };
  const module = core.requireOptionalNativeModule('ExpoNetwork') as { addListener: unknown } | null;
  if (!module) throw new Error('ExpoNetwork absent du preset Jest');
  module.addListener = (nom: string, ecouteur: EcouteurReseau) => {
    if (nom === 'onNetworkStateChanged') reseau = ecouteur;
    return {
      remove: () => {
        retires += 1;
        reseau = null;
      },
    };
  };
}

/** Fait croire que le binaire n'embarque pas le module de réseau. */
function sansModuleReseau() {
  const core = jest.requireActual('expo-modules-core') as { requireOptionalNativeModule: (nom: string) => unknown };
  const module = core.requireOptionalNativeModule('ExpoNetwork') as { addListener: unknown } | null;
  if (module) module.addListener = undefined;
}

beforeEach(() => {
  app = null;
  reseau = null;
  retires = 0;
  appels = 0;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://exemple.test';
  avecModuleReseau();

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
  /** Laisse se vider les micro-tâches : la sonde, son rattrapage d'échec et sa replanification sont asynchrones. */
  const vider = async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    if (jest.isMockFunction(setTimeout)) await jest.advanceTimersByTimeAsync(0);
  };

  it('sonde au démarrage puis espacée quand le serveur répond', async () => {
    jest.useFakeTimers();
    const c = charger();
    const arret = c.demarrerConnectivite();

    await vider();
    expect(appels).toBe(1);

    // Serveur joignable : cadence lente, rien à surveiller.
    await jest.advanceTimersByTimeAsync(c.INTERVALLE_EN_LIGNE_MS);
    await vider();
    expect(appels).toBe(2);

    await jest.advanceTimersByTimeAsync(c.INTERVALLE_EN_LIGNE_MS);
    await vider();
    expect(appels).toBe(3);

    arret();
  });

  it('accélère la cadence quand le serveur ne répond pas, puis ralentit', async () => {
    jest.useFakeTimers();
    (globalThis as { fetch?: unknown }).fetch = jest.fn(() => {
      appels += 1;
      return Promise.reject(new Error('serveur muet'));
    });
    const c = charger();
    const arret = c.demarrerConnectivite();

    await vider();
    expect(appels).toBe(1);

    // Premier échec : le délai suivant est le plus court, pour voir le retour du réseau tout de suite.
    await jest.advanceTimersByTimeAsync(c.DELAIS_REESSAI_MS[0]);
    await vider();
    expect(appels).toBe(2);

    await jest.advanceTimersByTimeAsync(c.DELAIS_REESSAI_MS[1]);
    await vider();
    expect(appels).toBe(3);

    // Beaucoup plus tard : la cadence s'est relâchée, on ne martèle plus le serveur.
    await jest.advanceTimersByTimeAsync(c.DELAIS_REESSAI_MS[c.DELAIS_REESSAI_MS.length - 1] * 3);
    const apresRelachement = appels;
    expect(apresRelachement).toBeLessThan(12);

    arret();
  });

  it('un signe de vie ramène la cadence au plus court', async () => {
    jest.useFakeTimers();
    (globalThis as { fetch?: unknown }).fetch = jest.fn(() => {
      appels += 1;
      return Promise.reject(new Error('serveur muet'));
    });
    const c = charger();
    const arret = c.demarrerConnectivite();
    await vider();

    // On laisse la cadence se relâcher jusqu'au plafond.
    for (let i = 0; i < c.DELAIS_REESSAI_MS.length; i += 1) {
      await jest.advanceTimersByTimeAsync(c.DELAIS_REESSAI_MS[i]);
      await vider();
    }
    const avant = appels;

    // L'utilisateur agit : on repart au plus rapide, donc une sonde arrive au premier délai court.
    c.signalerActivite();
    await jest.advanceTimersByTimeAsync(c.DELAIS_REESSAI_MS[0]);
    await vider();
    expect(appels).toBe(avant + 1);

    arret();
  });

  it('ne relance pas de sonde quand une est déjà en vol', async () => {
    const c = charger();
    const arret = c.demarrerConnectivite({ sonderAuDemarrage: false });

    c.sonderSiBesoin();
    c.sonderSiBesoin();
    c.sonderSiBesoin();
    await vider();
    expect(appels).toBe(1);

    arret();
  });

  it('arrête le sondage en arrière-plan et le reprend au retour', async () => {
    jest.useFakeTimers();
    const c = charger();
    const arret = c.demarrerConnectivite();
    await vider();
    const apresDemarrage = appels;

    app?.('background');
    await jest.advanceTimersByTimeAsync(c.INTERVALLE_EN_LIGNE_MS * 3);
    await vider();
    expect(appels).toBe(apresDemarrage);

    app?.('active');
    await vider();
    expect(appels).toBe(apresDemarrage + 1);

    arret();
  });

  it('arrête tout au démontage', async () => {
    jest.useFakeTimers();
    const c = charger();
    const arret = c.demarrerConnectivite();
    await vider();
    const apresDemarrage = appels;

    arret();
    await jest.advanceTimersByTimeAsync(c.INTERVALLE_EN_LIGNE_MS * 3);
    await vider();
    expect(appels).toBe(apresDemarrage);
  });
});

describe('connectivite : observation', () => {
  it('prévient les abonnés à chaque changement et se retire proprement', async () => {
    const c = charger();
    const vus: (boolean | null)[] = [];
    const desabonner = c.ecouterConnectivite((e) => vus.push(e.backend));

    const arret = c.demarrerConnectivite({ sonderAuDemarrage: false });
    // La sonde annonce son départ (`enVerification`), puis son échec (`backend` à false).
    await c.sonder(() => Promise.reject(new Error('muet')));
    c.signalerSucces();

    // Plusieurs publications pour une même transition sont permises (départ de sonde) : l'état final compte.
    expect(vus.length).toBeGreaterThanOrEqual(2);
    expect(vus).toContain(false);
    expect(c.lireConnectivite().backend).toBe(true);
    arret();
    desabonner();
  });

  it('annonce le départ et la fin d’une vérification', async () => {
    const c = charger();
    const vus: boolean[] = [];
    c.ecouterConnectivite((e) => vus.push(e.enVerification));

    await c.sonder(() => Promise.resolve());

    expect(vus[0]).toBe(true);
    expect(vus[vus.length - 1]).toBe(false);
    expect(c.lireConnectivite().enVerification).toBe(false);
  });

  it('le mode test force l’état', () => {
    const c = charger();
    c.definirConnectivitePourTest({ connecte: false, internet: false, backend: false });
    expect(c.estEnLigne()).toBe(false);
    c.definirConnectivitePourTest({ connecte: true, internet: true, backend: true });
    expect(c.estEnLigne()).toBe(true);
  });
});

describe('connectivite : évènements réseau du système', () => {
  it('un changement d’interface déclenche une sonde sans attendre le cycle', async () => {
    jest.useFakeTimers();
    avecModuleReseau();
    const c = charger();
    const arret = c.demarrerConnectivite({ sonderAuDemarrage: false });
    expect(appels).toBe(0);

    // Le système signale un changement : c'est le cas « mode avion » et « réseau retrouvé ».
    reseau?.({ isConnected: false, isInternetReachable: false });
    expect(appels).toBe(0);
    await jest.advanceTimersByTimeAsync(c.DEMI_TOUR_MS);
    await Promise.resolve();
    expect(appels).toBe(1);

    arret();
  });

  it('plusieurs évènements rapprochés ne sondent qu’une fois', async () => {
    jest.useFakeTimers();
    avecModuleReseau();
    const c = charger();
    const arret = c.demarrerConnectivite({ sonderAuDemarrage: false });

    reseau?.({ isConnected: false });
    reseau?.({ isConnected: true });
    reseau?.({ isConnected: false });
    await jest.advanceTimersByTimeAsync(c.DEMI_TOUR_MS);
    await Promise.resolve();

    expect(appels).toBe(1);
    arret();
  });

  it('l’évènement ne décide pas de l’état : c’est la sonde qui tranche', async () => {
    jest.useFakeTimers();
    avecModuleReseau();
    const c = charger();
    const arret = c.demarrerConnectivite({ sonderAuDemarrage: false });

    // Le système annonce « connecté », mais le serveur est muet : l'app doit rester hors ligne.
    (globalThis as { fetch?: unknown }).fetch = jest.fn(() => Promise.reject(new Error('serveur muet')));
    reseau?.({ isConnected: true, isInternetReachable: true });
    await jest.advanceTimersByTimeAsync(c.DEMI_TOUR_MS);
    await Promise.resolve();
    await Promise.resolve();

    expect(c.lireConnectivite().backend).toBe(false);
    expect(c.estEnLigne()).toBe(false);
    arret();
  });

  it('sans module natif, le repli par sondage continue de fonctionner', async () => {
    jest.useFakeTimers();
    // C'est le cas d'un APK construit avant l'ajout d'expo-network : aucun évènement, mais aucun plantage.
    sansModuleReseau();
    const c = charger();
    const arret = c.demarrerConnectivite({ sonderAuDemarrage: false });
    expect(reseau).toBeNull();

    c.signalerActivite();
    // Sans évènement réseau, seul le cycle périodique peut déclencher : on avance d'un intervalle complet.
    await jest.advanceTimersByTimeAsync(c.INTERVALLE_EN_LIGNE_MS);
    await Promise.resolve();

    expect(appels).toBeGreaterThanOrEqual(1);
    arret();
  });

  it('retire l’écouteur au démontage', () => {
    avecModuleReseau();
    const c = charger();
    const arret = c.demarrerConnectivite({ sonderAuDemarrage: false });
    expect(typeof reseau).toBe('function');

    arret();
    expect(retires).toBe(1);
  });

  it('le démontage ne lève pas et peut être appelé deux fois', () => {
    const c = charger();
    const arret = c.demarrerConnectivite({ sonderAuDemarrage: false });
    expect(() => arret()).not.toThrow();
    // Un second appel ne doit pas lever : React peut démonter deux fois en mode strict.
    expect(() => arret()).not.toThrow();
  });
});

describe('connectivite : validité du contenu hors ligne (7 jours)', () => {
  const JOUR = 24 * 3600 * 1000;

  it('sans contact connu, le contenu reste valable', async () => {
    const c = charger();
    c.definirDernierContactPourTest(null);
    // Un appareil qui n'a jamais joint le serveur n'a rien à synchroniser : le bloquer serait injuste.
    await expect(c.contenuHorsLigneValide()).resolves.toBe(true);
  });

  it('un contact récent garde le contenu valable', async () => {
    const c = charger();
    const maintenant = Date.UTC(2026, 9, 5, 12);
    c.definirDernierContactPourTest(maintenant - 6 * JOUR);
    await expect(c.contenuHorsLigneValide(maintenant)).resolves.toBe(true);
  });

  it('au-delà de 7 jours, le contenu expire', async () => {
    const c = charger();
    const maintenant = Date.UTC(2026, 9, 5, 12);
    c.definirDernierContactPourTest(maintenant - 8 * JOUR);
    await expect(c.contenuHorsLigneValide(maintenant)).resolves.toBe(false);
  });

  it('la limite exacte de 7 jours est encore valable', async () => {
    const c = charger();
    const maintenant = Date.UTC(2026, 9, 5, 12);
    c.definirDernierContactPourTest(maintenant - 7 * JOUR);
    await expect(c.contenuHorsLigneValide(maintenant)).resolves.toBe(true);
  });

  it('une sonde réussie enregistre le contact et repart la validité', async () => {
    const c = charger();
    c.definirDernierContactPourTest(null);
    const maintenant = Date.UTC(2026, 9, 5, 12);

    await c.sonder(() => Promise.resolve(), maintenant);
    // Le contact est désormais daté : une semaine plus tard, le contenu sera expiré.
    await expect(c.contenuHorsLigneValide(maintenant + 6 * JOUR)).resolves.toBe(true);
    await expect(c.contenuHorsLigneValide(maintenant + 8 * JOUR)).resolves.toBe(false);
  });
});
