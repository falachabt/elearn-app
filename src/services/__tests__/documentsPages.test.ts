import AsyncStorage from '@react-native-async-storage/async-storage';
import { PDFDocument } from 'pdf-lib';

import { documentLocal, ouvrirDocument } from '../documents';

const mockFichiers = new Map<string, Uint8Array>();
jest.mock('expo-file-system', () => {
  class Directory {
    exists = true;
    create() {}
    delete() {}
  }
  class File {
    uri: string;
    constructor(_d: unknown, nom: string) {
      this.uri = `file:///docs/${nom}`;
    }
    get exists() {
      return mockFichiers.has(this.uri);
    }
    get size() {
      return mockFichiers.get(this.uri)?.length ?? 0;
    }
    async arrayBuffer() {
      const o = mockFichiers.get(this.uri)!;
      return o.buffer.slice(o.byteOffset, o.byteOffset + o.byteLength);
    }
    write(o: Uint8Array) {
      mockFichiers.set(this.uri, o);
    }
    delete() {
      mockFichiers.delete(this.uri);
    }
    static async downloadFileAsync(_u: string, f: File) {
      mockFichiers.set(f.uri, mockTelecharge!);
      return f;
    }
  }
  return { Directory, File, Paths: { document: 'doc' } };
});

let mockTelecharge: Uint8Array | undefined;

async function pdf(tailles: [number, number][]) {
  const doc = await PDFDocument.create();
  tailles.forEach(([w, h]) => doc.addPage([w, h]));
  return doc.save();
}

describe('ouvrirDocument et pages de tailles voisines', () => {
  beforeEach(async () => {
    mockFichiers.clear();
    await AsyncStorage.clear();
  });

  it('met les pages à la même taille à la première ouverture, une seule fois', async () => {
    mockTelecharge = await pdf([[614, 794], [612, 792]]);
    const uri = await ouvrirDocument('https://x/a.pdf', 'A');
    const t = (await PDFDocument.load(mockFichiers.get(uri)!)).getPages().map((p) => p.getSize());
    expect(t[0]).toEqual(t[1]);
    const octets = mockFichiers.get(uri);
    await ouvrirDocument('https://x/a.pdf', 'A');
    expect(mockFichiers.get(uri)).toBe(octets);
    expect(documentLocal('https://x/a.pdf')).toBe(uri);
  });

  it('un PDF déjà uniforme reste tel quel', async () => {
    mockTelecharge = await pdf([[595, 842], [595, 842]]);
    const uri = await ouvrirDocument('https://x/b.pdf', 'B');
    expect(mockFichiers.get(uri)).toBe(mockTelecharge);
  });
});
