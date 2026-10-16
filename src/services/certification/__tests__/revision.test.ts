import { ErreurContenuExpire } from '../copie';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { definirApi } from '../api';
import {
  CLE_CARNET,
  CLE_FICHE,
  CLE_REVISION,
  chargerCarnet,
  chargerFiche,
  chargerRevision,
  chercherMots,
  compteursCarnet,
  coursDeLaFamille,
  lireFiche,
  morceauxMisEnValeur,
  motsEchus,
  motsParEtat,
  nombreDeFiches,
  nombreFragiles,
  normaliser,
  notionLaPlusFragile,
  notionsDeLaPartie,
  partieLaPlusFaible,
  totauxParEtat,
} from '../revision';
import { creerApiFausse } from './apiFausse';
import { FICHE_TEST, JOUR, MOTS_TEST, NOTIONS_TEST, PARTIES_TEST, REVISION_TEST } from './fixturesRevision';

const mockValable = jest.fn();
jest.mock('../../connectivite', () => ({ ...jest.requireActual('../../connectivite'), contenuHorsLigneValide: (...a: unknown[]) => mockValable(...a) }));

beforeEach(async () => {
  await AsyncStorage.clear();
  mockValable.mockResolvedValue(true);
});
afterEach(() => definirApi(null));

describe('C3 · notions d’une partie', () => {
  it('trie Fragile, En progrès, Pas commencée, Acquise puis l’ordre du référentiel', () => {
    const liste = notionsDeLaPartie(NOTIONS_TEST, 5).map((n) => n.titre);
    expect(liste).toEqual(['Forme du mot', 'Prépositions de temps', 'Vocabulaire du bureau', 'Temps du passé']);
  });

  it('la notion à travailler est la plus fragile de la partie', () => {
    expect(notionLaPlusFragile(NOTIONS_TEST, 5)?.titre).toBe('Forme du mot');
    expect(notionLaPlusFragile(NOTIONS_TEST, 3)).toBeNull();
  });

  it('une notion qui couvre deux parties apparaît dans les deux', () => {
    expect(notionsDeLaPartie(NOTIONS_TEST, 7).map((n) => n.id)).toEqual(['n-bureau', 'n-sans']);
  });
});

describe('C2 · carte de maîtrise', () => {
  it('AC-C2-1 : la somme des quatre totaux égale le nombre de notions publiées', () => {
    const t = totauxParEtat(NOTIONS_TEST);
    expect(t.acquise + t.en_progres + t.fragile + t.pas_commencee).toBe(NOTIONS_TEST.length);
    expect(t).toEqual({ acquise: 1, en_progres: 2, fragile: 1, pas_commencee: 2 });
  });

  it('la partie de plus faible maîtrise ignore celles sans réponse (S7)', () => {
    expect(partieLaPlusFaible(PARTIES_TEST)).toBe(5);
    expect(partieLaPlusFaible(PARTIES_TEST.map((p) => ({ ...p, reponses: 0 })))).toBeNull();
  });

  it('compte les notions fragiles pour la phrase d’accueil', () => {
    expect(nombreFragiles(NOTIONS_TEST)).toBe(1);
  });
});

describe('C4 · cours par famille', () => {
  it('un onglet n’affiche que sa famille, groupée par partie', () => {
    const g = coursDeLaFamille(NOTIONS_TEST, 'grammaire');
    expect(g).toHaveLength(1);
    expect(g[0].partie).toBe(5);
    expect(g[0].notions.map((n) => n.titre)).toEqual(['Forme du mot', 'Prépositions de temps', 'Temps du passé']);
    expect(coursDeLaFamille(NOTIONS_TEST, 'piege')[0].partie).toBe(6);
  });

  it('AC-C4-2 : une notion sans fiche publiée n’apparaît pas et n’est pas comptée', () => {
    expect(coursDeLaFamille(NOTIONS_TEST, 'methode')).toEqual([]);
    expect(nombreDeFiches(NOTIONS_TEST)).toBe(5);
  });
});

describe('C5 · lecture d’une fiche', () => {
  it('lit la règle, les exemples, le piège et le faux ami', () => {
    const f = lireFiche(FICHE_TEST.markdown);
    expect(f.regle).toContain('« on » pour un jour');
    expect(f.exemples).toHaveLength(2);
    expect(f.exemples[0]).toEqual({ en: 'We meet **on** Monday.', fr: 'Nous nous voyons lundi.' });
    expect(f.piege).toContain('until');
    expect(f.fauxAmi).toBe('actually ≠ actuellement');
  });

  it('un faux ami est facultatif et une fiche vide ne plante pas', () => {
    expect(lireFiche('## Règle\nUne règle.').fauxAmi).toBeNull();
    expect(lireFiche(null)).toEqual({ regle: null, exemples: [], piege: null, fauxAmi: null });
  });

  it('ne rend ni HTML ni lien : seul le **gras** est reconnu', () => {
    expect(morceauxMisEnValeur('We meet **on** Monday.')).toEqual([
      { texte: 'We meet ', fort: false },
      { texte: 'on', fort: true },
      { texte: ' Monday.', fort: false },
    ]);
    expect(morceauxMisEnValeur('<b>x</b> [a](http://b)')).toEqual([{ texte: '<b>x</b> [a](http://b)', fort: false }]);
  });
});

describe('C6 · carnet de mots', () => {
  it('AC-C6-1 et AC-C6-2 : les compteurs égalent les mots par état et leur somme le carnet', () => {
    const c = compteursCarnet(MOTS_TEST);
    expect(c).toEqual({ a_revoir: 2, en_cours: 1, connu: 1 });
    expect(c.a_revoir + c.en_cours + c.connu).toBe(MOTS_TEST.length);
    expect(motsParEtat(MOTS_TEST, 'a_revoir').map((m) => m.mot)).toEqual(['postpone', 'quarterly']);
  });

  it('AC-C6-3 : la recherche ignore casse et accents, dans le mot comme dans la définition', () => {
    expect(chercherMots(MOTS_TEST, 'POSTP').map((m) => m.mot)).toEqual(['postpone']);
    expect(chercherMots(MOTS_TEST, 'trimestriél').map((m) => m.mot)).toEqual(['quarterly']);
    expect(chercherMots(MOTS_TEST, 'date limite').map((m) => m.mot)).toEqual(['deadline']);
    expect(chercherMots(MOTS_TEST, 'contrat')).toEqual([]);
    expect(chercherMots(MOTS_TEST, '  ')).toHaveLength(MOTS_TEST.length);
    expect(normaliser('  Réunion ')).toBe('reunion');
  });

  it('les mots échus sont ceux dont la revue est arrivée', () => {
    expect(motsEchus(MOTS_TEST, JOUR).map((m) => m.mot)).toEqual(['postpone', 'deadline']);
  });
});

describe('copie hors ligne et expiration', () => {
  it('en ligne : lit le serveur et garde une copie', async () => {
    definirApi(creerApiFausse({ revision: REVISION_TEST, carnet: MOTS_TEST, fiche: FICHE_TEST }).api);
    expect((await chargerRevision('toeic', JOUR)).depuisCopie).toBe(false);
    expect((await chargerCarnet('toeic')).valeur).toHaveLength(4);
    expect((await chargerFiche('n-prepo')).valeur.titre).toBe('Prépositions de temps');
    expect(await AsyncStorage.getItem(CLE_REVISION('toeic'))).not.toBeNull();
    expect(await AsyncStorage.getItem(CLE_CARNET('toeic'))).not.toBeNull();
    expect(await AsyncStorage.getItem(CLE_FICHE('n-prepo'))).not.toBeNull();
  });

  it('hors ligne : sert la copie tant que le contenu est valable', async () => {
    definirApi(creerApiFausse({ revision: REVISION_TEST }).api);
    await chargerRevision('toeic', JOUR);
    definirApi(creerApiFausse({ revision: 'echec' }).api);
    const r = await chargerRevision('toeic', JOUR);
    expect(r.depuisCopie).toBe(true);
    expect(r.valeur.notions).toHaveLength(NOTIONS_TEST.length);
  });

  it('hors ligne au-delà de 7 jours : la copie est refusée et l’écran reçoit « contenu expiré » (S9)', async () => {
    definirApi(creerApiFausse({ carnet: MOTS_TEST }).api);
    await chargerCarnet('toeic');
    definirApi(creerApiFausse({ carnet: 'echec' }).api);
    mockValable.mockResolvedValue(false);
    await expect(chargerCarnet('toeic')).rejects.toBeInstanceOf(ErreurContenuExpire);
  });

  it('une copie récente n’empêche pas de relire le serveur : le carnet reste à jour après une séance', async () => {
    definirApi(creerApiFausse({ carnet: MOTS_TEST }).api);
    await chargerCarnet('toeic');
    definirApi(creerApiFausse({ carnet: [MOTS_TEST[0]] }).api);
    expect((await chargerCarnet('toeic')).valeur).toHaveLength(1);
  });
});
