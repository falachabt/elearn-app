import AsyncStorage from '@react-native-async-storage/async-storage';

import { ecrireContenu, ecrireContenus, lireContenu, lireContenus, nomFichierContenu, supprimerContenu, viderContenus } from '../stockageContenu';

/**
 * Issue #74, migration des contenus hors ligne vers les fichiers (retour terrain du 23 octobre 2026) :
 * rangés dans AsyncStorage, des milliers d'éléments ont saturé la base locale jusqu'à SQLITE_FULL.
 * Ici : les contenus vivent dans des fichiers ; AsyncStorage ne sert plus que de repli de lecture
 * pour les copies rangées par les anciennes versions, et chaque réécriture les en retire.
 */

const mockFichiers = new Map<string, string>();
jest.mock('expo-file-system', () => {
  class Directory {
    exists = true;
    uri = 'file:///docs';
    create() {}
    delete() {
      for (const k of [...mockFichiers.keys()]) if (k.startsWith(`${this.uri}/contenus/`)) mockFichiers.delete(k);
    }
  }
  class File {
    uri: string;
    constructor(d: Directory, nom: string) {
      this.uri = `${d.uri}/contenus/${nom}`;
    }
    get exists() {
      return mockFichiers.has(this.uri);
    }
    async text() {
      const v = mockFichiers.get(this.uri);
      if (v === undefined) throw new Error('fichier absent');
      return v;
    }
    write(v: string) {
      mockFichiers.set(this.uri, v);
    }
    delete() {
      mockFichiers.delete(this.uri);
    }
  }
  return { Directory, File, Paths: { document: new Directory() } };
});

beforeEach(async () => {
  mockFichiers.clear();
  await AsyncStorage.clear();
});

it('le nom de fichier est stable, sans caractère interdit, et distinct par clé', () => {
  expect(nomFichierContenu('reviser.lecon.42')).toBe(nomFichierContenu('reviser.lecon.42'));
  expect(nomFichierContenu('reviser.lecon.42')).not.toBe(nomFichierContenu('reviser.lecon.43'));
  expect(nomFichierContenu('mission.horsLigne.Tle.CM.classe.30.2026-10-23')).not.toMatch(/[^\w.-]/);
});

it('écrit dans un fichier, pas dans AsyncStorage — et la lecture retrouve la valeur', async () => {
  await ecrireContenu('reviser.lecon.42', '{"titre":"Limites"}');
  expect(await AsyncStorage.getItem('reviser.lecon.42')).toBeNull();
  expect(mockFichiers.size).toBe(1);
  expect(await lireContenu('reviser.lecon.42')).toBe('{"titre":"Limites"}');
});

it('lit encore l’ancienne copie AsyncStorage quand aucun fichier n’existe (migration en douceur)', async () => {
  await AsyncStorage.setItem('reviser.lecon.7', '{"ancien":true}');
  expect(await lireContenu('reviser.lecon.7')).toBe('{"ancien":true}');
});

it('le fichier gagne sur l’ancienne copie quand les deux existent', async () => {
  await AsyncStorage.setItem('reviser.lecon.9', '{"ancien":true}');
  await ecrireContenu('reviser.lecon.9', '{"nouveau":true}');
  expect(await lireContenu('reviser.lecon.9')).toBe('{"nouveau":true}');
});

it('réécrire une clé supprime son ancienne copie AsyncStorage : la base se vide au fil des téléchargements', async () => {
  await AsyncStorage.setItem('reviser.lecon.11', '{"ancien":true}');
  await ecrireContenu('reviser.lecon.11', '{"nouveau":true}');
  expect(await AsyncStorage.getItem('reviser.lecon.11')).toBeNull();
});

it('supprimer retire le fichier et l’ancienne copie', async () => {
  await ecrireContenu('credits.cache.x', '{"v":1}');
  await AsyncStorage.setItem('credits.cache.y', '{"v":2}');
  await supprimerContenu('credits.cache.x');
  await supprimerContenu('credits.cache.y');
  expect(await lireContenu('credits.cache.x')).toBeNull();
  expect(await lireContenu('credits.cache.y')).toBeNull();
});

it('lectures et écritures par lot (copie + sa date)', async () => {
  await ecrireContenus([
    ['reviser.cours.Tle.CM', '[1,2]'],
    ['reviser.cours.Tle.CM@v2', '12345'],
  ]);
  expect(await lireContenus(['reviser.cours.Tle.CM', 'reviser.cours.Tle.CM@v2', 'absente'])).toEqual(['[1,2]', '12345', null]);
});

it('vider supprime tous les fichiers de contenus', async () => {
  await ecrireContenu('a.1', '1');
  await ecrireContenu('b.2', '2');
  await viderContenus();
  expect(mockFichiers.size).toBe(0);
  expect(await lireContenu('a.1')).toBeNull();
});
