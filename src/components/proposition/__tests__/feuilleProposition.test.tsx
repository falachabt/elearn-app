import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { proposerSuggestion } from '@/services/concours';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { FeuilleProposition } from '../FeuilleProposition';

const mockRpc = jest.fn();
jest.mock('@/services/analytics', () => ({ suivre: jest.fn(), definirProprietesUtilisateur: jest.fn() }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }) }));

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (genre: 'concours' | 'certification') =>
  render(
    <SafeAreaProvider initialMetrics={metriques}>
      <ThemeProvider reglage="clair">
        <FeuilleProposition ouverte onFermer={jest.fn()} genre={genre} pays="sn" nomPays="Sénégal" />
      </ThemeProvider>
    </SafeAreaProvider>,
  );

beforeEach(() => jest.clearAllMocks());

describe('proposerSuggestion', () => {
  it('envoie le genre, le libellé nettoyé et le pays en majuscules', async () => {
    mockRpc.mockResolvedValue({ error: null });
    const res = await proposerSuggestion({ rpc: mockRpc } as never, { genre: 'certification', libelle: '  IELTS ', pays: 'sn' });
    expect(res).toBe('ok');
    expect(mockRpc).toHaveBeenCalledWith('submit_suggestion', { p_kind: 'certification', p_label: 'IELTS', p_country: 'SN', p_city: null });
  });

  it('renvoie « indisponible » quand la fonction serveur n’existe pas encore', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'function public.submit_suggestion does not exist', code: '42883' } });
    expect(await proposerSuggestion({ rpc: mockRpc } as never, { genre: 'concours', libelle: 'ENS', pays: 'CM' })).toBe('indisponible');
  });

  it('relance les autres erreurs', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'boom', code: '500' } });
    await expect(proposerSuggestion({ rpc: mockRpc } as never, { genre: 'concours', libelle: 'ENS', pays: 'CM' })).rejects.toBeTruthy();
  });
});

describe('FeuilleProposition', () => {
  it('concours : saisie, envoi, confirmation et évènement sans donnée personnelle', async () => {
    mockRpc.mockResolvedValue({ error: null });
    await monter('concours');
    await fireEvent.changeText(screen.getByLabelText(fr.proposition.champ_concours), 'Concours ENS');
    await fireEvent.changeText(screen.getByLabelText(fr.proposition.ville), 'Dakar');
    await fireEvent.press(screen.getByText(fr.proposition.envoyer));
    await waitFor(() => expect(screen.getByText(fr.proposition.merciTitre)).toBeTruthy());
    expect(mockRpc).toHaveBeenCalledWith('submit_suggestion', { p_kind: 'concours', p_label: 'Concours ENS', p_country: 'SN', p_city: 'Dakar' });
    expect(suivre).toHaveBeenCalledWith('suggestion_sent', { genre: 'concours', pays: 'sn' });
  });

  it('certification : pas de champ ville', async () => {
    await monter('certification');
    expect(screen.queryByLabelText(fr.proposition.ville)).toBeNull();
  });

  it('libellé trop court : rien n’est envoyé', async () => {
    await monter('certification');
    await fireEvent.changeText(screen.getByLabelText(fr.proposition.champ_certification), 'a');
    await fireEvent.press(screen.getByText(fr.proposition.envoyer));
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('échec serveur : message d’erreur et formulaire conservé', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'boom', code: '500' } });
    await monter('certification');
    await fireEvent.changeText(screen.getByLabelText(fr.proposition.champ_certification), 'IELTS');
    await fireEvent.press(screen.getByText(fr.proposition.envoyer));
    await waitFor(() => expect(screen.getByText(fr.proposition.erreur)).toBeTruthy());
  });
});
