import { dateLocale, lireCalendrierClasse, prochaineEcheance, versEcheance, type EcheanceClasse } from '../calendrier';

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
});
