import { PDFDocument, degrees } from 'pdf-lib';

import { uniformiserPages } from '../pdfPages';

async function fabriquer(tailles: [number, number][], rotation = 0): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  tailles.forEach(([w, h], i) => {
    const p = doc.addPage([w, h]);
    p.drawText(`page ${i + 1}`, { x: 20, y: h - 40 });
    if (rotation && i === 0) p.setRotation(degrees(rotation));
  });
  return doc.save();
}

const tailles = async (octets: Uint8Array) => (await PDFDocument.load(octets)).getPages().map((p) => [p.getWidth(), p.getHeight()]);

describe('uniformiserPages', () => {
  it('met à la même taille des pages qui diffèrent d’un point ou deux (le glitch de la dernière page)', async () => {
    const sortie = await uniformiserPages(await fabriquer([[614.047, 794.408], [612.602, 792.482]]));
    expect(sortie).not.toBeNull();
    const t = await tailles(sortie!);
    expect(t[0]).toEqual(t[1]);
    expect(t[0][0]).toBeCloseTo(614.047, 2);
    expect(t[0][1]).toBeCloseTo(794.408, 2);
    expect((await PDFDocument.load(sortie!)).getPageCount()).toBe(2);
  });

  it('ne touche pas un PDF déjà uniforme, d’une seule page, ou aux formats réellement mixtes', async () => {
    expect(await uniformiserPages(await fabriquer([[595, 842], [595, 842]]))).toBeNull();
    expect(await uniformiserPages(await fabriquer([[595, 842]]))).toBeNull();
    expect(await uniformiserPages(await fabriquer([[595, 842], [842, 595]]))).toBeNull();
    expect(await uniformiserPages(await fabriquer([[612, 792], [614, 794]], 90))).toBeNull();
  });

  it('renvoie null sur un fichier illisible', async () => {
    expect(await uniformiserPages(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
