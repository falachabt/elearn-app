import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CLE_PROPOSITION_HORS_LIGNE,
  doitProposerHorsLigne,
  noterPropositionHorsLigne,
  propositionDue,
  propositionEligible,
  variantePourStatut,
} from '../propositionHorsLigne';

const MAINTENANT = new Date('2026-10-23T10:00:00');
const ilYa = (jours: number) => new Date(MAINTENANT.getTime() - jours * 24 * 60 * 60 * 1000);

describe('variantePourStatut', () => {
  it('pack absent ou seulement estimé : variante absent', () => {
    expect(variantePourStatut(null)).toBe('absent');
    expect(variantePourStatut('pret')).toBe('absent');
  });
  it('pack partiel : variante partiel', () => {
    expect(variantePourStatut('partiel')).toBe('partiel');
  });
  it('téléchargement en cours ou terminé : rien à proposer', () => {
    expect(variantePourStatut('telechargement')).toBeNull();
    expect(variantePourStatut('termine')).toBeNull();
  });
});

describe('propositionEligible', () => {
  const base = { invite: false, profilTermine: true, statutPack: null, declencheur: true } as const;
  it('toutes conditions réunies', () => {
    expect(propositionEligible(base)).toBe(true);
    expect(propositionEligible({ ...base, statutPack: 'partiel' })).toBe(true);
  });
  it('un invité n’est jamais sollicité', () => {
    expect(propositionEligible({ ...base, invite: true })).toBe(false);
  });
  it('profil non terminé : pas encore', () => {
    expect(propositionEligible({ ...base, profilTermine: false })).toBe(false);
  });
  it('sans déclencheur, on ne propose pas à chaque ouverture', () => {
    expect(propositionEligible({ ...base, declencheur: false })).toBe(false);
  });
  it('pack déjà téléchargé ou en cours : jamais', () => {
    expect(propositionEligible({ ...base, statutPack: 'termine' })).toBe(false);
    expect(propositionEligible({ ...base, statutPack: 'telechargement' })).toBe(false);
  });
});

describe('propositionDue (cadence)', () => {
  it('jamais montrée : due', () => {
    expect(propositionDue(null, MAINTENANT)).toBe(true);
  });
  it('montrée il y a quelques heures : pas avant demain', () => {
    expect(propositionDue({ vus: 1, le: ilYa(0.2).toISOString() }, MAINTENANT)).toBe(false);
  });
  it('montrée il y a deux jours, sous le plafond : due', () => {
    expect(propositionDue({ vus: 2, le: ilYa(2).toISOString() }, MAINTENANT)).toBe(true);
  });
  it('plafond de 3 affichages atteint : plus jamais', () => {
    expect(propositionDue({ vus: 3, le: ilYa(30).toISOString() }, MAINTENANT)).toBe(false);
  });
});

describe('doitProposerHorsLigne + noterPropositionHorsLigne (stockage)', () => {
  const eligible = { invite: false, profilTermine: true, statutPack: null, declencheur: true } as const;
  it('première fois : oui ; juste après l’affichage : non (délai d’un jour)', async () => {
    expect(await doitProposerHorsLigne(eligible, MAINTENANT)).toBe(true);
    await noterPropositionHorsLigne(MAINTENANT);
    expect(await doitProposerHorsLigne(eligible, MAINTENANT)).toBe(false);
    expect(await doitProposerHorsLigne(eligible, ilYa(-2))).toBe(true);
  });
  it('le compteur s’accumule jusqu’au plafond', async () => {
    await noterPropositionHorsLigne(ilYa(5));
    await noterPropositionHorsLigne(ilYa(3));
    await noterPropositionHorsLigne(ilYa(2));
    const brut = await AsyncStorage.getItem(CLE_PROPOSITION_HORS_LIGNE);
    expect(JSON.parse(brut ?? '{}').vus).toBe(3);
    expect(await doitProposerHorsLigne(eligible, MAINTENANT)).toBe(false);
  });
  it('non éligible : jamais, même sans historique', async () => {
    expect(await doitProposerHorsLigne({ ...eligible, invite: true }, MAINTENANT)).toBe(false);
  });
});
