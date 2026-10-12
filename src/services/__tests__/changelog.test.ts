import { chargerDernierChangelog, textesChangelog, type Changelog } from '../changelog';

describe('changelog', () => {
  const changelogComplet: Changelog = {
    id: 'cl-1',
    version: '1.2.0',
    title_fr: 'Titre en français',
    title_en: 'Title in English',
    content_fr: 'Contenu en français',
    content_en: 'Content in English',
    obligatoire: false,
    published_at: '2026-10-12T10:00:00Z',
  };

  const changelogRepliFr: Changelog = {
    id: 'cl-2',
    version: '1.2.1',
    title_fr: 'Titre FR seul',
    title_en: null,
    content_fr: 'Contenu FR seul',
    content_en: '',
    obligatoire: true,
    published_at: '2026-10-12T11:00:00Z',
  };

  describe('textesChangelog', () => {
    it('renvoie les textes français pour la langue fr', () => {
      const res = textesChangelog(changelogComplet, 'fr');
      expect(res.titre).toBe('Titre en français');
      expect(res.contenu).toBe('Contenu en français');
    });

    it('renvoie les textes anglais pour la langue en', () => {
      const res = textesChangelog(changelogComplet, 'en');
      expect(res.titre).toBe('Title in English');
      expect(res.contenu).toBe('Content in English');
    });

    it('replie vers le français si le titre ou le contenu anglais est absent', () => {
      const res = textesChangelog(changelogRepliFr, 'en');
      expect(res.titre).toBe('Titre FR seul');
      expect(res.contenu).toBe('Contenu FR seul');
    });
  });

  describe('chargerDernierChangelog', () => {
    it('charge le dernier changelog publié avec succès', async () => {
      const mockClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                maybeSingle: jest.fn(() => Promise.resolve({ data: changelogComplet, error: null })),
              })),
            })),
          })),
        })),
      };

      const res = await chargerDernierChangelog(mockClient as never);
      expect(res).toEqual(changelogComplet);
      expect(mockClient.from).toHaveBeenCalledWith('changelogs');
    });

    it('charge une version spécifique si versionCible est fournie', async () => {
      const mockClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => ({
                  maybeSingle: jest.fn(() => Promise.resolve({ data: changelogRepliFr, error: null })),
                })),
              })),
            })),
          })),
        })),
      };

      const res = await chargerDernierChangelog(mockClient as never, '1.2.1');
      expect(res).toEqual(changelogRepliFr);
      expect(mockClient.from).toHaveBeenCalledWith('changelogs');
    });

    it('gère silencieusement les erreurs Supabase et renvoie null', async () => {
      const mockClient = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: new Error('table manquante') })),
              })),
            })),
          })),
        })),
      };

      const res = await chargerDernierChangelog(mockClient as never);
      expect(res).toBeNull();
    });
  });
});
