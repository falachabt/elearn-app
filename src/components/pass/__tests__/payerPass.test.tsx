import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { ErreurPaiement } from '@/services/paiementPass';
import { enregistrerProfil } from '@/services/profil';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { PayerPass } from '../PayerPass';

const mockMethodes = jest.fn();
const mockPayer = jest.fn();
const mockSuivre = jest.fn();
const mockRafraichir = jest.fn(async () => {});
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }, useLocalSearchParams: () => ({ offre: 'month' }) }));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({ rpc: jest.fn(async () => ({ data: 'cancelled', error: null })) }) }));
jest.mock('@/session/CreditsProvider', () => ({ useCredits: () => ({ rafraichir: mockRafraichir }) }));
jest.mock('@/services/paiementPass', () => {
  const actuel = jest.requireActual('@/services/paiementPass');
  return {
    ...actuel,
    modeEssai: () => false,
    lireMethodes: (...a: unknown[]) => mockMethodes(...a),
    lirePaysPaiement: async () => [{ alpha2: 'SN', name: 'Sénégal', flag: null, prefix: '221', currencies: ['XOF'] }],
    payerMobileMoney: (...a: unknown[]) => mockPayer(...a),
    suivreCommande: (...a: unknown[]) => mockSuivre(...a),
    annulerCommande: async () => 'echoue',
  };
});

const CM = {
  payable: true, country: 'CM', countryName: 'Cameroun', prefix: '237', currency: 'XAF',
  offers: [{ code: 'month', amount: 2500, currency: 'XAF', converted: false, recommended: true, durationDays: 30 }],
  providers: [{ provider: 'MTN_MOMO_CMR', name: 'MTN MoMo', logo: 'https://x/mtn.png', available: true, currency: 'XAF', min: 100, max: 1000000, authType: 'PROVIDER_AUTH', pinPrompt: 'AUTOMATIC', delayed: false }],
};
const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = () => render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair"><PayerPass /></ThemeProvider></SafeAreaProvider>);

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'eleve', niveau: '3e', pays: 'CM', termine: true });
  mockMethodes.mockResolvedValue(CM);
});

describe('choix du pays dans une feuille avec recherche', () => {
  it('« Changer » ouvre la feuille ; la recherche ignore accents et majuscules ; choisir recharge le pays', async () => {
    await monter();
    await screen.findByText('MTN MoMo');
    await fireEvent.press(screen.getByRole('button', { name: fr.paiement.changerPays }));
    expect(await screen.findByText(fr.paiement.choisirPays)).toBeTruthy();
    expect(screen.getByLabelText('Sénégal')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText(fr.paiement.rechercherPays), 'SENEG');
    expect(screen.getByLabelText('Sénégal')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText(fr.paiement.rechercherPays), 'zzz');
    expect(screen.getByText(fr.paiement.aucunPays)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText(fr.paiement.rechercherPays), 'sen');
    await fireEvent.press(screen.getByLabelText('Sénégal'));
    await waitFor(() => expect(mockMethodes).toHaveBeenLastCalledWith('SN', 'fr'));
  });
});

describe('paiement du pass par Mobile Money', () => {
  it('prix dans la devise du pays, opérateur unique présélectionné, paiement direct puis attente et succès', async () => {
    mockPayer.mockResolvedValue({ statut: 'en_attente', commande: 'c1', pinPrompt: 'AUTOMATIC' });
    mockSuivre.mockResolvedValue({ statut: 'reussi', commande: 'c1', recu: 'EP-AB12-0001', finPass: '2026-11-30T00:00:00Z' });
    await monter();
    expect((await screen.findAllByText(/2.500 FCFA/)).length).toBeGreaterThan(0);
    expect(screen.getByText('MTN MoMo')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText(fr.paiement.numero), '6 53 45 67 89');
    await fireEvent.press(screen.getByRole('button', { name: /Payer/ }));
    await waitFor(() => expect(mockPayer).toHaveBeenCalled());
    expect(mockPayer.mock.calls[0][1]).toMatchObject({ offre: 'month', pays: 'CM', telephone: '6 53 45 67 89', operateur: 'MTN_MOMO_CMR' });
    // E4 : titre, durée du pass, reçu avec référence.
    expect(await screen.findByText(fr.paiement.reussiTitre.replace('{{offre}}', 'pass mois'))).toBeTruthy();
    expect(screen.getByText('EP-AB12-0001')).toBeTruthy();
    expect(screen.getByText(fr.paiement.reussiTexte.replace('{{date}}', new Date('2026-11-30T00:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })))).toBeTruthy();
    expect(mockRafraichir).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: fr.paiement.reprendre }));
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('numéro vide : message, aucun appel', async () => {
    await monter();
    await screen.findByText('MTN MoMo');
    await fireEvent.press(screen.getByRole('button', { name: /Payer/ }));
    expect(screen.getByText(fr.paiement.numeroInvalide)).toBeTruthy();
    expect(mockPayer).not.toHaveBeenCalled();
  });

  it('solde insuffisant : écran d’échec avec « aucun montant retiré » et l’astuce du proche', async () => {
    mockPayer.mockRejectedValue(new ErreurPaiement('refuse', 'Solde insuffisant', 'c9', 'INSUFFICIENT_BALANCE'));
    await monter();
    await screen.findByText('MTN MoMo');
    await fireEvent.changeText(screen.getByLabelText(fr.paiement.numero), '653456789');
    await fireEvent.press(screen.getByRole('button', { name: /Payer/ }));
    expect(await screen.findByText(fr.paiement.echecs.solde.titre)).toBeTruthy();
    expect(screen.getByText(fr.paiement.echecs.solde.texte)).toBeTruthy();
    expect(screen.getByText(fr.paiement.echecs.solde.astuce)).toBeTruthy();
  });

  it('numéro refusé par l’opérateur : « Changer de numéro » revient au formulaire', async () => {
    mockPayer.mockRejectedValue(new ErreurPaiement('refuse', '', 'c9', 'PAYER_NOT_FOUND'));
    await monter();
    await screen.findByText('MTN MoMo');
    await fireEvent.changeText(screen.getByLabelText(fr.paiement.numero), '653456789');
    await fireEvent.press(screen.getByRole('button', { name: /Payer/ }));
    expect(await screen.findByText(fr.paiement.echecs.numero.titre)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: fr.paiement.changerNumero }));
    expect(screen.getByLabelText(fr.paiement.numero)).toBeTruthy();
  });

  it('panne réseau : message dans le formulaire, rien n’est parti', async () => {
    mockPayer.mockRejectedValue(new ErreurPaiement('reseau'));
    await monter();
    await screen.findByText('MTN MoMo');
    await fireEvent.changeText(screen.getByLabelText(fr.paiement.numero), '653456789');
    await fireEvent.press(screen.getByRole('button', { name: /Payer/ }));
    expect(await screen.findByText(fr.paiement.erreurs.reseau)).toBeTruthy();
  });

  it('opérateur indisponible : carte grisée « Indisponible » et bandeau qui l’explique, non sélectionnable', async () => {
    mockMethodes.mockResolvedValue({ ...CM, providers: [CM.providers[0], { ...CM.providers[0], provider: 'ORANGE_CMR', name: 'Orange Money', available: false }] });
    await monter();
    await screen.findByText('Orange Money');
    expect(screen.getByText(fr.paiement.indisponible)).toBeTruthy();
    expect(screen.getByText(fr.paiement.indisponibleBandeau.replace('{{operateur}}', 'Orange Money').replace('{{autre}}', 'MTN MoMo'))).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Orange Money/ }).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('attente : trois étapes, compte à rebours, annulation confirmée, lien « demander à quelqu’un de payer »', async () => {
    mockPayer.mockResolvedValue({ statut: 'en_attente', commande: 'c1', pinPrompt: 'AUTOMATIC' });
    mockSuivre.mockReturnValue(new Promise(() => {}));
    await monter();
    await screen.findByText('MTN MoMo');
    await fireEvent.changeText(screen.getByLabelText(fr.paiement.numero), '653456789');
    await fireEvent.press(screen.getByRole('button', { name: /Payer/ }));
    expect(await screen.findByText(fr.paiement.attenteTitre)).toBeTruthy();
    expect(screen.getByText(fr.paiement.etape1.replace('{{operateur}}', 'MTN MoMo'))).toBeTruthy();
    expect(screen.getByText(fr.paiement.etape2)).toBeTruthy();
    expect(screen.getByText(fr.paiement.etape3)).toBeTruthy();
    expect(screen.getByText(fr.paiement.attenteExpire.replace('{{temps}}', '10:00'))).toBeTruthy();
    expect(screen.getByRole('button', { name: fr.paiement.demanderPayer })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: fr.paiement.annuler }));
    expect(screen.getByText(fr.paiement.annulerTitre)).toBeTruthy();
    await fireEvent.press(screen.getByText(fr.paiement.annulerOui));
    await waitFor(() => expect(screen.getByLabelText(fr.paiement.numero)).toBeTruthy());
  });

  it('paiement expiré : on le dit et on propose de réessayer', async () => {
    mockPayer.mockResolvedValue({ statut: 'en_attente', commande: 'c1' });
    mockSuivre.mockResolvedValue({ statut: 'expire', commande: 'c1' });
    await monter();
    await screen.findByText('MTN MoMo');
    await fireEvent.changeText(screen.getByLabelText(fr.paiement.numero), '653456789');
    await fireEvent.press(screen.getByRole('button', { name: /Payer/ }));
    // E5 : « Le délai est dépassé », réessayer, demander à quelqu'un de payer, changer de numéro.
    expect(await screen.findByText(fr.paiement.echecs.delai.titre)).toBeTruthy();
    expect(screen.getByText(fr.paiement.echecs.delai.texte)).toBeTruthy();
    expect(screen.getByRole('button', { name: fr.paiement.reessayer })).toBeTruthy();
    expect(screen.getByRole('button', { name: fr.paiement.demanderPayer })).toBeTruthy();
    expect(screen.getByRole('button', { name: fr.paiement.changerNumero })).toBeTruthy();
  });

  it('pays sans pawaPay : on le dit et on propose de faire payer un parent', async () => {
    mockMethodes.mockResolvedValue({ payable: false, country: 'CM', offers: [], providers: [] });
    await monter();
    expect(await screen.findByText(fr.paiement.indisponibleTitre)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: fr.paiement.demanderPayer }));
    expect(router.replace).toHaveBeenCalledWith({ pathname: '/offres/parent', params: { offre: 'month' } });
  });

  it('opérateur à code d’autorisation (PREAUTH) : le code est demandé avant de payer', async () => {
    mockMethodes.mockResolvedValue({ ...CM, providers: [{ ...CM.providers[0], provider: 'ORANGE_SEN', name: 'Orange Money', authType: 'PREAUTH', pinPrompt: 'MANUAL' }] });
    await monter();
    await screen.findByText('Orange Money');
    await fireEvent.changeText(screen.getByLabelText(fr.paiement.numero), '771234567');
    await fireEvent.press(screen.getByRole('button', { name: /Payer/ }));
    expect(screen.getByText(fr.paiement.codeRequis)).toBeTruthy();
    expect(mockPayer).not.toHaveBeenCalled();
  });
});
