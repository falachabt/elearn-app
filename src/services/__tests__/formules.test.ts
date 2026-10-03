import AsyncStorage from '@react-native-async-storage/async-storage';
import { CLE_FORMULES, chargerRenduFormules, decouper, definirRenduFormules, estComplexe, formuleSvg, lireRenduFormules } from '../formules';

describe('estComplexe', () => {
  it('ne dessine que les formules à deux étages', () => {
    expect(estComplexe('\\frac{a}{b}')).toBe(true);
    expect(estComplexe('\\sqrt{2}')).toBe(true);
    expect(estComplexe('\\lim_{x \\to 0} f(x)')).toBe(true);
    expect(estComplexe("f'(x) = nax^{n-1}")).toBe(false);
    expect(estComplexe('x')).toBe(false);
    expect(estComplexe('\\sum_{k=1}^n k')).toBe(true);
    expect(estComplexe('\\limsup')).toBe(false);
  });
});

describe('formuleSvg', () => {
  it('donne un SVG et ses dimensions en ex', () => {
    const f = formuleSvg('\\frac{x_{max} - x_{min}}{k}');
    expect(f).not.toBeNull();
    expect(f!.xml.startsWith('<svg')).toBe(true);
    expect(f!.largeurEx).toBeGreaterThan(0);
    expect(f!.hauteurEx).toBeGreaterThan(1);
    expect(f!.descenteEx).toBeGreaterThan(0);
  });

  it('renvoie null sur un LaTeX invalide (on garde le texte)', () => {
    expect(formuleSvg('\\frac{a')).toBeNull();
  });
});

describe('réglage', () => {
  it('activé par défaut, mémorisé', async () => {
    await AsyncStorage.clear();
    expect(await chargerRenduFormules()).toBe(true);
    await definirRenduFormules(true);
    expect(lireRenduFormules()).toBe(true);
    expect(await AsyncStorage.getItem(CLE_FORMULES)).toBe('rendu');
    await definirRenduFormules(false);
    expect(await chargerRenduFormules()).toBe(false);
  });
});

describe('decouper', () => {
  it('ne coupe pas ce qui tient sur une ligne sans relation', () => {
    expect(decouper('\\frac{a}{b}', 1)).toEqual([['\\frac{a}{b}']]);
  });

  it('coupe aux relations, en gardant l’opérateur en tête de chaque morceau', () => {
    expect(decouper('\\frac{2+8-1}{3} = \\frac{9}{3} = 3', 1)).toEqual([['\\frac{2+8-1}{3}', '= \\frac{9}{3}', '= 3']]);
  });

  it('au niveau 2, coupe aussi aux + et −, mais pas dans les accolades ni après un opérateur', () => {
    expect(decouper('a + b - \\frac{c+d}{e} = -f', 2)).toEqual([['a', '+ b', '- \\frac{c+d}{e}', '= -f']]);
  });

  it('les \\\\ du premier niveau font des lignes, pas ceux d’un tableau', () => {
    expect(decouper('x + y = 1 \\\\ x - y = 3', 1)).toEqual([['x + y', '= 1'], ['x - y', '= 3']]);
    expect(decouper('\\begin{array}{l} a = 1 \\\\ b = 2 \\end{array}', 2)).toEqual([['\\begin{array}{l} a = 1 \\\\ b = 2 \\end{array}']]);
  });

  it('ne coupe pas dans \\left … \\right', () => {
    expect(decouper('\\left( a + b = c \\right) = d', 2)).toEqual([['\\left( a + b = c \\right)', '= d']]);
  });
});
