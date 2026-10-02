import { declencherPhoto, definirDeclencheur } from '../obturateur';

describe('obturateur : déclencheur de l’appareil photo', () => {
  afterEach(() => definirDeclencheur(null));

  it('ne fait rien tant que l’appareil n’est pas prêt', () => {
    expect(declencherPhoto()).toBe(false);
  });
  it('prend la photo quand l’écran caméra a enregistré son déclencheur', () => {
    const prise = jest.fn();
    definirDeclencheur(prise);
    expect(declencherPhoto()).toBe(true);
    expect(prise).toHaveBeenCalledTimes(1);
  });
  it('n’agit plus une fois l’écran caméra quitté', () => {
    const prise = jest.fn();
    definirDeclencheur(prise);
    definirDeclencheur(null);
    expect(declencherPhoto()).toBe(false);
    expect(prise).not.toHaveBeenCalled();
  });
});
