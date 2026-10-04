import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';

import {
  aDesActionsDisponibles,
  enregistrerActionQuotidienne,
  executerActionQuotidienne,
  lireEtatActionsQuotidiennes,
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
    expect(Linking.openURL).toHaveBeenCalledWith('https://elearnprepa.online/reclamer-credits?token=user-123');
    expect(onSucces).toHaveBeenCalledWith(10);

    const etat = await lireEtatActionsQuotidiennes(dateMock);
    expect(etat.site_web).toBe(true);
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
