import { obtenirApi } from '../api';

const mockRpc = jest.fn();
const mockRefresh = jest.fn(() => Promise.resolve({ data: {}, error: null }));

jest.mock('../../supabase', () => ({
  getSupabase: () => ({ rpc: (...args: unknown[]) => mockRpc(...args), auth: { refreshSession: () => mockRefresh() } }),
}));

const tentative = { attempt_id: 'a1', questions: [], replay: false };

describe('appels RPC TOEIC : premier lancement à froid', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockRefresh.mockClear();
  });

  it('rafraîchit la session et rejoue l’appel quand le serveur répond « authentification requise »', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: '28000', message: 'authentification requise' } });
    mockRpc.mockResolvedValueOnce({ data: tentative, error: null });

    await expect(obtenirApi().demarrerDiagnostic('c1', 'toeic', '2026-10-21')).resolves.toEqual(tentative);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });

  it("ne rejoue pas une erreur qui n'est pas une session (contenu indisponible)", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { code: 'P0002', message: 'contenu indisponible' } });

    await expect(obtenirApi().demarrerDiagnostic('c1', 'toeic', '2026-10-21')).rejects.toThrow('contenu indisponible');
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it('ne fait pas de réessai en boucle : une seconde erreur de session remonte', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '28000', message: 'authentification requise' } });

    await expect(obtenirApi().demarrerDiagnostic('c1', 'toeic', '2026-10-21')).rejects.toThrow('authentification requise');
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});
