import AsyncStorage from '@react-native-async-storage/async-storage';

import { CLE_CALENDRIER_CLASSE, dateLocale, lireCalendrierClasse, prochaineEcheance, versEcheance, type EcheanceClasse } from '../calendrier';
import { definirConnectivitePourTest } from '../connectivite';

beforeEach(() => AsyncStorage.clear());

const echeance = (type: 'examen' | 'fin_de_cours', iso: string, libelle = 'BEPC'): EcheanceClasse => ({
  type,
  libelle,
  dateCible: dateLocale(iso),
  statut: 'reprise',
  anneeScolaire: '2026-2027',
});

describe('calendrier de la classe', () => {
  it('une date « AAAA-MM-JJ » devient minuit local de ce jour, sans décalage', () => {
    const d = dateLocale('2027-06-14');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2027, 5, 14, 0]);
  });

  it('une ligne de la base devient une échéance ; un type inconnu est ignoré', () => {
    expect(versEcheance({ type: 'examen', libelle: 'BEPC', date_cible: '2027-06-14', statut: 'reprise', annee_scolaire: '2026-2027' })?.type).toBe('examen');
    expect(versEcheance({ type: 'autre', libelle: 'x', date_cible: '2027-06-14', statut: 'reprise', annee_scolaire: '2026-2027' })).toBeNull();
  });

  it('choisit la date future la plus proche, et ignore les dates passées', () => {
    const maintenant = new Date(2027, 0, 1);
    const choisie = prochaineEcheance([echeance('fin_de_cours', '2026-06-26'), echeance('examen', '2027-06-14'), echeance('fin_de_cours', '2027-06-26')], maintenant);
    expect(choisie?.type).toBe('examen');
    expect(choisie?.dateCible).toEqual(dateLocale('2027-06-14'));
  });

  it("à date égale, l'examen passe avant la fin de cours", () => {
    const maintenant = new Date(2027, 0, 1);
    const choisie = prochaineEcheance([echeance('fin_de_cours', '2027-06-14'), echeance('examen', '2027-06-14')], maintenant);
    expect(choisie?.type).toBe('examen');
  });

  it('rien à venir : pas de compte à rebours', () => {
    expect(prochaineEcheance([echeance('examen', '2026-06-14')], new Date(2027, 0, 1))).toBeNull();
    expect(prochaineEcheance([], new Date(2027, 0, 1))).toBeNull();
  });

  it('lit la RPC calendrier_de_ma_classe avec le niveau et le pays du profil', async () => {
    const rpc = jest.fn(async () => ({
      data: [{ type: 'examen', libelle: 'BEPC', date_cible: '2027-06-14', statut: 'reprise', annee_scolaire: '2026-2027' }],
      error: null,
    }));
    const lues = await lireCalendrierClasse({ rpc } as never, '3e', 'CM');
    expect(rpc).toHaveBeenCalledWith('calendrier_de_ma_classe', { p_niveau: '3e', p_pays: 'CM' });
    expect(lues).toHaveLength(1);
  });

  it('une erreur de la base remonte (l’accueil cache alors la carte)', async () => {
    const rpc = jest.fn(async () => ({ data: null, error: { message: 'boom' } }));
    await expect(lireCalendrierClasse({ rpc } as never, '3e', 'CM')).rejects.toEqual({ message: 'boom' });
  });

  // Issue #74 : l'accueil ne montre le compte à rebours et la carte planning que s'il connaît l'échéance de la classe.
  // Sans copie locale, les deux disparaissaient hors ligne alors même que le planning a la sienne.
  describe('copie locale pour le hors ligne', () => {
    const LIGNES = [{ type: 'examen', libelle: 'BEPC', date_cible: '2027-06-14', statut: 'reprise', annee_scolaire: '2026-2027' }];
    const RESEAU = { name: 'TypeError', message: 'Network request failed' };
    const enLigne = () => jest.fn(async () => ({ data: LIGNES, error: null }));
    const horsLigne = () => jest.fn(async () => ({ data: null, error: RESEAU }));

    it('une lecture en ligne garde une copie, par niveau et par pays', async () => {
      await lireCalendrierClasse({ rpc: enLigne() } as never, '3e', 'CM');
      expect(await AsyncStorage.getItem(CLE_CALENDRIER_CLASSE('3e', 'CM'))).not.toBeNull();
      expect(await AsyncStorage.getItem(CLE_CALENDRIER_CLASSE('Tle', 'CM'))).toBeNull();
      expect(await AsyncStorage.getItem(CLE_CALENDRIER_CLASSE('3e', 'BF'))).toBeNull();
    });

    it('hors ligne : la copie de cette classe est servie, avec les mêmes échéances', async () => {
      await lireCalendrierClasse({ rpc: enLigne() } as never, '3e', 'CM');
      const lues = await lireCalendrierClasse({ rpc: horsLigne() } as never, '3e', 'CM');
      expect(lues).toHaveLength(1);
      expect(lues[0]).toMatchObject({ type: 'examen', libelle: 'BEPC' });
      expect(lues[0].dateCible).toEqual(dateLocale('2027-06-14'));
      // La copie d'une autre classe ne sert jamais.
      await expect(lireCalendrierClasse({ rpc: horsLigne() } as never, 'Tle', 'CM')).rejects.toEqual(RESEAU);
    });

    it('hors ligne sans copie : l’erreur remonte, comme avant', async () => {
      await expect(lireCalendrierClasse({ rpc: horsLigne() } as never, '3e', 'CM')).rejects.toEqual(RESEAU);
    });

    it('une erreur qui n’est pas le réseau remonte même avec une copie', async () => {
      await lireCalendrierClasse({ rpc: enLigne() } as never, '3e', 'CM');
      const rpc = jest.fn(async () => ({ data: null, error: { message: 'boom' } }));
      await expect(lireCalendrierClasse({ rpc } as never, '3e', 'CM')).rejects.toEqual({ message: 'boom' });
    });

    it('hors ligne déjà connu : la copie est servie sans appeler la RPC', async () => {
      await lireCalendrierClasse({ rpc: enLigne() } as never, '3e', 'CM');
      definirConnectivitePourTest({ backend: false });
      try {
        const rpc = enLigne();
        const lues = await lireCalendrierClasse({ rpc } as never, '3e', 'CM');
        expect(lues).toHaveLength(1);
        expect(rpc).not.toHaveBeenCalled();
      } finally {
        definirConnectivitePourTest({ backend: null });
      }
    });

    it('une copie illisible vaut pas de copie', async () => {
      await AsyncStorage.setItem(CLE_CALENDRIER_CLASSE('3e', 'CM'), '{pas du json');
      await expect(lireCalendrierClasse({ rpc: horsLigne() } as never, '3e', 'CM')).rejects.toEqual(RESEAU);
    });
  });
});
