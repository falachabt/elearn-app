import AsyncStorage from '@react-native-async-storage/async-storage';
import { CLE_FORMULES, chargerRenduFormules, definirRenduFormules, estComplexe, formuleSvg, lireRenduFormules } from '../formules';

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
  it('désactivé par défaut, mémorisé', async () => {
    await AsyncStorage.clear();
    expect(await chargerRenduFormules()).toBe(false);
    await definirRenduFormules(true);
    expect(lireRenduFormules()).toBe(true);
    expect(await AsyncStorage.getItem(CLE_FORMULES)).toBe('rendu');
    await definirRenduFormules(false);
    expect(await chargerRenduFormules()).toBe(false);
  });
});
