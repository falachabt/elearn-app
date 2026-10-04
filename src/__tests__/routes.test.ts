import fs from 'fs';
import path from 'path';

/**
 * Test de garde de l'arborescence des routes Expo Router.
 * Vérifie qu'aucun fichier `nom.tsx` n'existe à côté d'un dossier `nom/index.tsx` (ou `nom.js`, etc.),
 * ce qui provoquerait l'erreur fatale "Found conflicting screens with the same pattern".
 */
describe('Structure des routes Expo Router', () => {
  const dossierApp = path.join(__dirname, '../app');

  function verifierConflitsRoutes(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entrees = fs.readdirSync(dir, { withFileTypes: true });

    const fichiersBase = new Set<string>();
    const dossiers = new Set<string>();

    for (const entree of entrees) {
      if (entree.isDirectory()) {
        dossiers.add(entree.name);
        verifierConflitsRoutes(path.join(dir, entree.name));
      } else if (entree.isFile()) {
        const nomSansExt = entree.name.replace(/\.(tsx|ts|jsx|js)$/, '');
        if (nomSansExt !== entree.name && nomSansExt !== '_layout' && nomSansExt !== 'index') {
          fichiersBase.add(nomSansExt);
        }
      }
    }

    for (const nom of fichiersBase) {
      if (dossiers.has(nom)) {
        const dossierCible = path.join(dir, nom);
        const aIndex = fs.existsSync(path.join(dossierCible, 'index.tsx')) || fs.existsSync(path.join(dossierCible, 'index.ts'));
        if (aIndex) {
          fail(`Conflit de route détecté : le fichier '${nom}.tsx' entre en conflit avec le dossier '${nom}/index.tsx' dans ${dir}`);
        }
      }
    }
  }

  it('ne contient aucun conflit entre fichier de route et dossier index', () => {
    verifierConflitsRoutes(dossierApp);
  });
});
