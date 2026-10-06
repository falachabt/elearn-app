import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';

import {
  aDesActionsDisponibles,
  crediterRecompenseServeur,
  enregistrerActionQuotidienne,
  executerActionQuotidienne,
  jourServeur,
  lireEtatActionsQuotidiennes,
  reclamerActionServeur,
} from '../actionsCredits';

jest.mock('expo-linking', () => ({
  openURL: jest.fn().mockResolvedValue(true),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('../supabase', () => ({
  getSupabase: jest.fn(() => ({
    rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
    from: jest.fn(() => ({
      insert: jest.fn().mockResolvedValue({ error: null }),
    })),
  })),
}));

jest.mock('../rappels', () => ({
  mefierNotificationReward: jest.fn().mockResolvedValue(undefined),
  planifierNotificationRappelHebdo: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('actionsCredits service', () => {
  it('lit l’état initial des actions comme non accomplies', async () => {
    const etat = await lireEtatActionsQuotidiennes();
    expect(etat).toEqual({ site_web: false, facebook: false, instagram: false, parrainage: false });
  });

  it('enregistre l’accomplissement d’une action pour le jour courant', async () => {
    await enregistrerActionQuotidienne('facebook');
    const etat = await lireEtatActionsQuotidiennes();
    expect(etat.facebook).toBe(true);
    expect(etat.site_web).toBe(false);
  });

  it('détecte correctement si des actions sont disponibles selon le solde', async () => {
    const dateMock = new Date('2026-10-04T10:00:00Z');
    expect(await aDesActionsDisponibles(null, dateMock)).toBe(true);
    expect(await aDesActionsDisponibles({ illimite: true } as never, dateMock)).toBe(false);

    await enregistrerActionQuotidienne('site_web', dateMock);
    await enregistrerActionQuotidienne('facebook', dateMock);
    await enregistrerActionQuotidienne('instagram', dateMock);

    expect(await aDesActionsDisponibles({ illimite: false } as never, dateMock)).toBe(false);
  });

  it('exécute l’action site_web : ouvre le lien avec le token et attribue le gain', async () => {
    const onSucces = jest.fn();
    const dateMock = new Date('2026-10-04T10:00:00Z');

    const res = await executerActionQuotidienne('site_web', {
      utilisateurId: 'user-123',
      onSucces,
      maintenant: dateMock,
    });

    expect(res).toBe(true);
    expect(Linking.openURL).toHaveBeenCalledWith('https://elearnprepa.com?token=user-123');
    expect(onSucces).toHaveBeenCalledWith(10);

    // L'état est rangé par élève.
    const etat = await lireEtatActionsQuotidiennes(dateMock, { utilisateurId: 'user-123' });
    expect(etat.site_web).toBe(true);
    expect((await lireEtatActionsQuotidiennes(dateMock, { utilisateurId: 'autre' })).site_web).toBe(false);
  });

  it('exécute l’action parrainage en redirigeant vers la route /parrainage', async () => {
    const res = await executerActionQuotidienne('parrainage');
    expect(res).toBe(true);
    expect(router.push).toHaveBeenCalledWith('/parrainage');
  });

  it('ne ré-attribue pas le gain si l’action a déjà été faite aujourd’hui', async () => {
    const dateMock = new Date('2026-10-04T10:00:00Z');
    await enregistrerActionQuotidienne('facebook', dateMock);

    const onSucces = jest.fn();
    const res = await executerActionQuotidienne('facebook', { onSucces, maintenant: dateMock });

    expect(res).toBe(false);
    expect(onSucces).not.toHaveBeenCalled();
    expect(Linking.openURL).toHaveBeenCalledWith('https://facebook.com/elearnprepa');
  });
});

/** Client dont la table `daily_reward_claims` renvoie `reclamees` et dont `claim_daily_action` renvoie `gain`. */
function clientServeur({ reclamees = [] as string[], gain = 10 as number | null, erreurLecture = false, erreurRpc = false } = {}) {
  const eq = jest.fn(async () => (erreurLecture ? { data: null, error: new Error('hors ligne') } : { data: reclamees.map((a) => ({ action_code: a })), error: null }));
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select }));
  const rpc = jest.fn(async () => (erreurRpc ? { data: null, error: new Error('serveur') } : { data: gain, error: null }));
  return { client: { from, rpc } as never, eq, from, rpc };
}

describe('actions du jour : le serveur fait foi', () => {
  const jour = new Date('2026-10-06T10:00:00Z');

  it('le jour est celui de Douala (UTC+1), pas celui du téléphone', () => {
    expect(jourServeur(new Date('2026-10-05T22:30:00Z'))).toBe('2026-10-05');
    expect(jourServeur(new Date('2026-10-05T23:30:00Z'))).toBe('2026-10-06');
  });

  it('après une déconnexion, les actions déjà réclamées s’affichent comme faites', async () => {
    const { client, from, eq } = clientServeur({ reclamees: ['site_web', 'facebook'] });
    const etat = await lireEtatActionsQuotidiennes(jour, { client, utilisateurId: 'u1' });
    expect(etat).toEqual({ site_web: true, facebook: true, instagram: false, parrainage: false });
    expect(from).toHaveBeenCalledWith('daily_reward_claims');
    expect(eq).toHaveBeenCalledWith('claim_date', '2026-10-06');
  });

  it('garde l’état serveur sur le téléphone pour le hors ligne', async () => {
    const { client } = clientServeur({ reclamees: ['site_web'] });
    await lireEtatActionsQuotidiennes(jour, { client, utilisateurId: 'u1' });
    const horsLigne = clientServeur({ erreurLecture: true });
    const etat = await lireEtatActionsQuotidiennes(jour, { client: horsLigne.client, utilisateurId: 'u1' });
    expect(etat.site_web).toBe(true);
    expect(etat.facebook).toBe(false);
  });

  it('sans réponse du serveur, garde ce que le téléphone sait', async () => {
    await enregistrerActionQuotidienne('instagram', jour, 'u1');
    const { client } = clientServeur({ erreurLecture: true });
    expect((await lireEtatActionsQuotidiennes(jour, { client, utilisateurId: 'u1' })).instagram).toBe(true);
  });

  it('serveur qui ne répond pas : on rend l’état du téléphone au lieu d’attendre sans fin', async () => {
    jest.useFakeTimers();
    try {
      await enregistrerActionQuotidienne('facebook', jour, 'u1');
      const client = { from: () => ({ select: () => ({ eq: () => new Promise(() => {}) }) }), rpc: jest.fn() } as never;
      const attente = lireEtatActionsQuotidiennes(jour, { client, utilisateurId: 'u1' });
      await jest.advanceTimersByTimeAsync(6500);
      expect((await attente).facebook).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('ne mélange pas les comptes d’un même téléphone', async () => {
    await enregistrerActionQuotidienne('facebook', jour, 'u1');
    const { client } = clientServeur({ reclamees: [] });
    expect((await lireEtatActionsQuotidiennes(jour, { client, utilisateurId: 'u2' })).facebook).toBe(false);
  });

  it('le point « actions disponibles » tient compte du serveur', async () => {
    const { client } = clientServeur({ reclamees: ['site_web', 'facebook', 'instagram'] });
    expect(await aDesActionsDisponibles({ illimite: false } as never, jour, { client, utilisateurId: 'u1' })).toBe(false);
    const { client: partiel } = clientServeur({ reclamees: ['site_web'] });
    expect(await aDesActionsDisponibles({ illimite: false } as never, jour, { client: partiel, utilisateurId: 'u2' })).toBe(true);
  });

  it('réclamer : crédité, déjà réclamé ou erreur', async () => {
    expect(await reclamerActionServeur(clientServeur({ gain: 10 }).client, 'site_web')).toBe('credite');
    expect(await reclamerActionServeur(clientServeur({ gain: 0 }).client, 'site_web')).toBe('deja');
    expect(await reclamerActionServeur(clientServeur({ erreurRpc: true }).client, 'site_web')).toBe('erreur');
    expect(await crediterRecompenseServeur(clientServeur({ gain: 5 }).client, 'facebook')).toBe(true);
    expect(await crediterRecompenseServeur(clientServeur({ gain: 0 }).client, 'facebook')).toBe(false);
  });

  it('déjà réclamé côté serveur : l’action passe à « faite », sans crédit de plus', async () => {
    const { client } = clientServeur({ reclamees: [], gain: 0 });
    const onSucces = jest.fn();
    const onDejaFait = jest.fn();
    const res = await executerActionQuotidienne('facebook', { client, utilisateurId: 'u1', onSucces, onDejaFait, maintenant: jour });
    expect(res).toBe(false);
    expect(onSucces).not.toHaveBeenCalled();
    expect(onDejaFait).toHaveBeenCalledTimes(1);
    expect((await lireEtatActionsQuotidiennes(jour, { utilisateurId: 'u1' })).facebook).toBe(true);
  });

  it('erreur réseau pendant la réclamation : rien n’est marqué, on peut réessayer', async () => {
    const { client } = clientServeur({ reclamees: [], erreurRpc: true });
    const onDejaFait = jest.fn();
    const res = await executerActionQuotidienne('facebook', { client, utilisateurId: 'u1', onDejaFait, maintenant: jour });
    expect(res).toBe(false);
    expect(onDejaFait).not.toHaveBeenCalled();
    expect((await lireEtatActionsQuotidiennes(jour, { utilisateurId: 'u1' })).facebook).toBe(false);
  });

  it('déjà faite selon le serveur : ouvre le lien sans réclamer', async () => {
    const { client, rpc } = clientServeur({ reclamees: ['facebook'] });
    const res = await executerActionQuotidienne('facebook', { client, utilisateurId: 'u1', maintenant: jour });
    expect(res).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    expect(Linking.openURL).toHaveBeenCalledWith('https://facebook.com/elearnprepa');
  });

  it('première réclamation : crédite, marque et prévient', async () => {
    const { client, rpc } = clientServeur({ reclamees: [], gain: 5 });
    const onSucces = jest.fn();
    const res = await executerActionQuotidienne('instagram', { client, utilisateurId: 'u1', onSucces, maintenant: jour });
    expect(res).toBe(true);
    expect(rpc).toHaveBeenCalledWith('claim_daily_action', { p_action_code: 'instagram' });
    expect(onSucces).toHaveBeenCalledWith(5);
    expect((await lireEtatActionsQuotidiennes(jour, { utilisateurId: 'u1' })).instagram).toBe(true);
  });
});
