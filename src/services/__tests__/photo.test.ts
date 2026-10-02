import { texteAvecFormules } from '../blocs';
import { blocsDepuisTexte, cadrePixels, etatsEtapes, issueDe, lireLignes, segmentsDepuisTexte, tailleReduite, texteDePartage, type CorrectionPhoto } from '../photo';

const c: CorrectionPhoto = {
  matiere: 'maths',
  enonce: 'Résoudre $2x+3=11$.',
  methode: 'Isoler $x$.',
  etapes: [{ titre: 'On retire 3', detail: '$2x=8$' }],
  resultat: '$x=4$',
  a_retenir: 'Même opération des deux côtés.',
  notion: 'Équations',
};

describe('photo : image', () => {
  it('borne le cadre à l’image', () => {
    expect(cadrePixels({ x: 0.1, y: 0.2, largeur: 0.5, hauteur: 0.5 }, 1000, 2000)).toEqual({ x: 100, y: 400, largeur: 500, hauteur: 1000 });
    expect(cadrePixels({ x: 0.9, y: 0.9, largeur: 0.5, hauteur: 0.5 }, 1000, 2000)).toEqual({ x: 900, y: 1800, largeur: 100, hauteur: 200 });
    expect(cadrePixels({ x: -1, y: 2, largeur: 0, hauteur: 0 }, 10, 10)).toEqual({ x: 0, y: 9, largeur: 1, hauteur: 1 });
  });
  it('réduit le côté le plus long à 1280', () => {
    expect(tailleReduite(4000, 3000)).toEqual({ width: 1280 });
    expect(tailleReduite(1000, 3000)).toEqual({ height: 1280 });
    expect(tailleReduite(800, 600)).toBeNull();
  });
});

describe('photo : flux', () => {
  it('lit les lignes complètes et garde la ligne coupée', () => {
    const r = lireLignes('{"t":"etape","etape":"enonce"}\n{"t":"fin","id":"a","correction":{}}\n{"t":"etap');
    expect(r.evenements.map((e) => e.t)).toEqual(['etape', 'fin']);
    expect(r.reste).toBe('{"t":"etap');
  });
  it('ignore le bruit', () => {
    expect(lireLignes('pas du json\n\n{"x":1}\n').evenements).toEqual([]);
  });
  it('issue finale', () => {
    expect(issueDe({ t: 'etape', etape: 'enonce' })).toBeNull();
    expect(issueDe({ t: 'illisible', id: 'a', raison: 'floue' })).toEqual({ type: 'illisible', raison: 'floue' });
    expect(issueDe({ t: 'erreur', code: 'ia' })).toEqual({ type: 'erreur' });
    expect(issueDe({ t: 'fin', id: 'a', correction: c })).toEqual({ type: 'fin', id: 'a', correction: c });
  });
});

describe('photo : texte', () => {
  it('sépare texte et formules', () => {
    const s = segmentsDepuisTexte('Calcule $\\frac{1}{2}$ puis $x^2$.');
    expect(s.map((x) => !!x.math)).toEqual([false, true, false, true, false]);
    expect(s[1].latex).toBe('\\frac{1}{2}');
    expect(s[3].texte).toBe('x²');
  });
  it('un paragraphe par ligne', () => {
    expect(blocsDepuisTexte('a\n\nb')).toHaveLength(2);
  });
  it('partage WhatsApp lisible, avec la marque', () => {
    const m = texteDePartage(c, { cherche: 'Ce qu’on cherche', methode: 'Méthode', resultat: 'Résultat', retenir: 'À retenir', signature: 'Elearn Prépa' });
    expect(m).toContain('1. On retire 3 : 2x=8');
    expect(m).toContain('*Résultat* : x=4');
    expect(m).not.toContain('$');
    expect(m.endsWith('Elearn Prépa')).toBe(true);
  });
});

describe('photo : étapes de l’analyse', () => {
  it('la première étape tourne dès l’envoi', () => {
    expect(etatsEtapes([])).toEqual(['en_cours', 'attente', 'attente', 'attente']);
    expect(etatsEtapes(['enonce'])).toEqual(['en_cours', 'attente', 'attente', 'attente']);
  });
  it('une étape se termine quand la suivante démarre', () => {
    expect(etatsEtapes(['enonce', 'methode'])).toEqual(['fait', 'en_cours', 'attente', 'attente']);
    expect(etatsEtapes(['enonce', 'methode', 'redaction'])).toEqual(['fait', 'fait', 'en_cours', 'attente']);
  });
  it('la dernière étape tourne jusqu’à la correction', () => {
    expect(etatsEtapes(['enonce', 'methode', 'redaction', 'resultat'])).toEqual(['fait', 'fait', 'fait', 'en_cours']);
  });
  it('un signal manquant ne bloque pas les étapes déjà passées', () => {
    expect(etatsEtapes(['redaction'])).toEqual(['fait', 'fait', 'en_cours', 'attente']);
  });
});

describe('photo : titre d’étape', () => {
  it('convertit les formules du titre comme celles du détail', () => {
    expect(texteAvecFormules('Équation 1 : $x^2 - 5x + 6 = 0$')).toBe('Équation 1 : x² - 5x + 6 = 0');
  });
});
