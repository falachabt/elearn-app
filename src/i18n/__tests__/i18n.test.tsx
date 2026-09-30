import { render, screen, act } from '@testing-library/react-native';
import { getLocales } from 'expo-localization';
import { Text } from 'react-native';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { en } from '../en';
import { fr } from '../fr';
import { changerLangue, detecterLangue, i18n, langueSupportee } from '../index';
import { useTraduction } from '../useTraduction';

jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));

/** Liste triée de tous les chemins de clés d'un arbre de textes. */
function chemins(arbre: object, prefixe = ''): string[] {
  return Object.entries(arbre)
    .flatMap(([cle, valeur]) =>
      typeof valeur === 'string' ? [`${prefixe}${cle}`] : chemins(valeur as object, `${prefixe}${cle}.`),
    )
    .sort();
}

function Casse(): never {
  throw new Error('boum');
}

function Titre() {
  const { t, langue } = useTraduction();
  return <Text>{`${langue}:${t('accueil.accroche')}`}</Text>;
}

afterEach(async () => {
  await act(() => changerLangue('fr'));
});

describe('textes', () => {
  it('fr et en ont exactement les mêmes clés', () => {
    expect(chemins(en)).toEqual(chemins(fr));
    expect(chemins(fr).length).toBeGreaterThan(0);
  });

  it('aucun texte anglais vide', () => {
    const vides = chemins(en).filter((c) => !c.split('.').reduce((o: any, k) => o[k], en));
    expect(vides).toEqual([]);
  });
});

describe('détection de la langue', () => {
  it('prend la première langue prise en charge', () => {
    expect(detecterLangue(['en-US', 'fr-FR'])).toBe('en');
    expect(detecterLangue(['de-DE', 'fr-FR'])).toBe('fr');
    expect(langueSupportee('EN_gb')).toBe('en');
  });

  it('se replie sur le français quand la langue est inconnue ou absente', () => {
    expect(detecterLangue(['de-DE', 'ja'])).toBe('fr');
    expect(detecterLangue([])).toBe('fr');
    expect(detecterLangue([null, undefined])).toBe('fr');
  });

  it('lit la langue de l’appareil via expo-localization', () => {
    const mock = getLocales as jest.Mock;
    mock.mockReturnValueOnce([{ languageTag: 'en-GB', languageCode: 'en' }]);
    expect(detecterLangue()).toBe('en');
    mock.mockImplementationOnce(() => {
      throw new Error('indisponible');
    });
    expect(detecterLangue()).toBe('fr');
  });

  it('le français est la langue initiale de l’instance', () => {
    expect(i18n.language).toBe('fr');
  });
});

describe('changement de langue', () => {
  it('une langue inconnue retombe sur le français', async () => {
    await act(() => changerLangue('en'));
    expect(i18n.t('actions.commencer')).toBe('Get started');
    await act(() => changerLangue('zz'));
    expect(i18n.t('actions.commencer')).toBe('Commencer');
  });

  it('une clé absente d’une langue se replie sur le français', () => {
    i18n.addResource('fr', 'translation', 'test.seulementFr', 'Seulement en français');
    expect(i18n.t('test.seulementFr', { lng: 'en' })).toBe('Seulement en français');
  });

  it('les clés sont typées', () => {
    function Mauvaise() {
      const { t } = useTraduction();
      // @ts-expect-error clé inexistante
      return <Text>{t('accueil.nexistepas')}</Text>;
    }
    expect(Mauvaise).toBeDefined();
  });

  it('le hook suit la langue', async () => {
    await render(<Titre />);
    expect(screen.getByText('fr:Le tuteur de poche.')).toBeTruthy();
    await act(() => changerLangue('en'));
    expect(screen.getByText('en:Your pocket tutor.')).toBeTruthy();
  });
});

describe('composant rendu dans les deux langues', () => {
  async function rendre() {
    const consoleErr = jest.spyOn(console, 'error').mockImplementation(() => {});
    await render(
      <ThemeProvider>
        <ErrorBoundary>
          <Casse />
        </ErrorBoundary>
      </ThemeProvider>,
    );
    consoleErr.mockRestore();
  }

  it('en français', async () => {
    await rendre();
    expect(screen.getByText('Un problème est survenu')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('en anglais', async () => {
    await act(() => changerLangue('en'));
    await rendre();
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});
