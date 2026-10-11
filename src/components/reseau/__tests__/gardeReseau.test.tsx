import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useGardeReseau } from '../useGardeReseau';

jest.mock('../useReseau', () => ({ useReseau: jest.fn() }));

const { useReseau } = jest.requireMock('../useReseau') as { useReseau: jest.Mock };

/** Fixe l'état réseau vu par la garde. */
function reseau(estEnLigne: boolean) {
  useReseau.mockReturnValue({ estEnLigne, connecte: estEnLigne, internet: estEnLigne, backend: estEnLigne, actualiseLe: '2026-10-05T10:00:00.000Z' });
}

beforeEach(() => {
  useReseau.mockReset();
  reseau(true);
});

describe('garde réseau : action bloquée hors ligne', () => {
  it('n’exécute pas l’action et signale le besoin de connexion', async () => {
    reseau(false);
    const { result } = await renderHook(() => useGardeReseau());
    const action = jest.fn(() => Promise.resolve('fait'));

    let valeur: unknown = 'jamais-appele';
    await act(async () => {
      valeur = await result.current!.garde(action);
    });

    expect(action).not.toHaveBeenCalled();
    expect(valeur).toBeNull();
    expect(result.current!.bloque).toBe(true);
    expect(result.current!.banniere).toBeTruthy();
  });

  it('signale le blocage sans action, pour les appels qui ne peuvent pas être enrobés', async () => {
    reseau(false);
    const { result } = await renderHook(() => useGardeReseau());
    await act(async () => result.current!.bloquerReseau());
    expect(result.current!.bloque).toBe(true);
  });
});

describe('garde réseau : action exécutée en ligne', () => {
  it('rend le résultat de l’action et ne signale rien', async () => {
    reseau(true);
    const { result } = await renderHook(() => useGardeReseau());
    const action = jest.fn(() => Promise.resolve(42));

    let valeur: unknown = null;
    await act(async () => {
      valeur = await result.current!.garde(action);
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(valeur).toBe(42);
    expect(result.current!.bloque).toBe(false);
    expect(result.current!.banniere).toBeNull();
    expect(result.current!.horsLigne).toBe(false);
  });

  it('expose horsLigne quand le backend est injoignable', async () => {
    reseau(false);
    const { result } = await renderHook(() => useGardeReseau());
    expect(result.current!.horsLigne).toBe(true);
  });
});

describe('garde réseau : reprise au retour du réseau', () => {
  it('efface le blocage dès que la connexion revient', async () => {
    reseau(false);
    const { result, rerender } = await renderHook(() => useGardeReseau());

    await act(async () => {
      await result.current!.garde(() => Promise.resolve('fait'));
    });
    expect(result.current!.bloque).toBe(true);

    // Le réseau revient : l'élève doit voir la bannière disparaître et pouvoir relancer son action.
    reseau(true);
    await act(async () => {
      await rerender({});
    });
    await waitFor(() => expect(result.current!.bloque).toBe(false));
    expect(result.current!.banniere).toBeNull();
  });
});
