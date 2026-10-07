import { appliquerCouleurNavigateur } from '../couleurNavigateur';

// Mini document : assez de DOM pour la balise (jsdom ne s'accorde pas avec le preset Expo).
type Balise = { attrs: Record<string, string>; setAttribute: (k: string, v: string) => void; removeAttribute: (k: string) => void; hasAttribute: (k: string) => boolean; getAttribute: (k: string) => string | null; remove: () => void };
const balise = (attrs: Record<string, string>, liste: Balise[]): Balise => {
  const b: Balise = {
    attrs: { ...attrs },
    setAttribute: (k, v) => void (b.attrs[k] = v),
    removeAttribute: (k) => void delete b.attrs[k],
    hasAttribute: (k) => k in b.attrs,
    getAttribute: (k) => b.attrs[k] ?? null,
    remove: () => void liste.splice(liste.indexOf(b), 1),
  };
  return b;
};
const doc = (initiales: Record<string, string>[]) => {
  const liste: Balise[] = [];
  initiales.forEach((a) => liste.push(balise(a, liste)));
  const d = {
    head: { querySelectorAll: () => [...liste], appendChild: (b: Balise) => void liste.push(b) },
    createElement: () => balise({}, liste),
  };
  return { d: d as unknown as Document, liste };
};
const deux = [
  { name: 'theme-color', content: '#FFF7E3', media: '(prefers-color-scheme: light)' },
  { name: 'theme-color', content: '#141614', media: '(prefers-color-scheme: dark)' },
];

describe('couleur de la barre du navigateur', () => {
  it('remplace les deux balises liées au système par une seule, à la couleur du thème', () => {
    const { d, liste } = doc(deux);
    appliquerCouleurNavigateur('#141614', d);
    expect(liste).toHaveLength(1);
    expect(liste[0].getAttribute('content')).toBe('#141614');
    expect(liste[0].hasAttribute('media')).toBe(false);
  });

  it('suit un changement de thème sans dupliquer la balise', () => {
    const { d, liste } = doc(deux);
    appliquerCouleurNavigateur('#141614', d);
    appliquerCouleurNavigateur('#FFF7E3', d);
    expect(liste).toHaveLength(1);
    expect(liste[0].getAttribute('content')).toBe('#FFF7E3');
  });

  it('crée la balise si elle manque, et ne fait rien sans document', () => {
    const { d, liste } = doc([]);
    appliquerCouleurNavigateur('#FFF7E3', d);
    expect(liste).toHaveLength(1);
    expect(liste[0].getAttribute('name')).toBe('theme-color');
    expect(() => appliquerCouleurNavigateur('#000', undefined)).not.toThrow();
  });
});
