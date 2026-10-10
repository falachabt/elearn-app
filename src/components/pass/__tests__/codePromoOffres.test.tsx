import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { lireCodePartage } from '@/services/codePromo';
import { enregistrerProfil } from '@/services/profil';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { Offres } from '../Offres';
import { PayerPass } from '../PayerPass';
import { oublierCodePromo } from '../useCodePromo';

const mockOffres = jest.fn();
const mockAcces = jest.fn();
const mockVerifierTous = jest.fn();
const mockVerifier = jest.fn();
const mockMethodes = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({}) }));
jest.mock('@/session/SessionProvider', () => ({ useSession: () => ({ session: { user: { is_anonymous: false } } }) }));
jest.mock('@/session/CreditsProvider', () => ({ useCredits: () => ({ rafraichir: jest.fn(async () => {}) }) }));
jest.mock('@gorhom/bottom-sheet', () => {
  const passe = ({ children }: { children?: React.ReactNode }) => children ?? null;
  return { __esModule: true, default: passe, BottomSheetView: passe, BottomSheetModal: passe, BottomSheetModalProvider: passe, BottomSheetBackdrop: () => null };
});
jest.mock('@/services/pass', () => ({
  ...jest.requireActual('@/services/pass'),
  lireOffres: (...a: unknown[]) => mockOffres(...a),
  lireAcces: (...a: unknown[]) => mockAcces(...a),
}));
jest.mock('@/services/codePromo', () => ({
  ...jest.requireActual('@/services/codePromo'),
  verifierCodePromoOffres: (...a: unknown[]) => mockVerifierTous(...a),
  verifierCodePromo: (...a: unknown[]) => mockVerifier(...a),
}));
jest.mock('@/services/paiementPass', () => ({
  ...jest.requireActual('@/services/paiementPass'),
  modeEssai: () => false,
  lireMethodes: (...a: unknown[]) => mockMethodes(...a),
  lirePaysPaiement: async () => [],
}));

const OFFRES = [
  { code: 'week', montant: 500, devise: 'XAF', recommandee: false, dureeJours: 7, finSaison: null },
  { code: 'month', montant: 2500, devise: 'XAF', recommandee: true, dureeJours: 30, finSaison: null },
  { code: 'contest', montant: 7500, devise: 'XAF', recommandee: false, dureeJours: null, finSaison: '2027-08-31' },
];
const CM = {
  payable: true, country: 'CM', countryName: 'Cameroun', prefix: '237', currency: 'XAF',
  offers: [
    { code: 'week', amount: 500, currency: 'XAF', converted: false, recommended: false, durationDays: 7 },
    { code: 'month', amount: 2500, currency: 'XAF', converted: false, recommended: true, durationDays: 30 },
    { code: 'contest', amount: 7500, currency: 'XAF', converted: false, recommended: false, durationDays: 180 },
  ],
  providers: [{ provider: 'MTN_MOMO_CMR', name: 'MTN MoMo', logo: null, available: true, currency: 'XAF', min: 100, max: 1000000, authType: 'PROVIDER_AUTH', pinPrompt: 'AUTOMATIC', delayed: false }],
};
const tous20 = {
  valide: true, code: 'TOUS20', type: 'pct', valeur: 20, devise: 'XAF',
  offres: {
    week: { valable: true, prixInitial: 500, prixFinal: 400, etiquette: '-20 %' },
    month: { valable: true, prixInitial: 2500, prixFinal: 2000, etiquette: '-20 %' },
    contest: { valable: true, prixInitial: 7500, prixFinal: 6000, etiquette: '-20 %' },
  },
};
const concoursSeul = {
  valide: true, code: 'CONCOURS', type: 'pct', valeur: 10, devise: 'XAF',
  offres: { week: { valable: false }, month: { valable: false }, contest: { valable: true, prixInitial: 7500, prixFinal: 6750, etiquette: '-10 %' } },
};
const offertSemaine = {
  valide: true, code: 'OFFERT', type: 'fixe', valeur: 500, devise: 'XAF',
  offres: {
    week: { valable: true, prixInitial: 500, prixFinal: 0, etiquette: '-500 FCFA' },
    month: { valable: true, prixInitial: 2500, prixFinal: 2000, etiquette: '-500 FCFA' },
    contest: { valable: true, prixInitial: 7500, prixFinal: 7000, etiquette: '-500 FCFA' },
  },
};
const appliqueMois = { valide: true, code: 'TOUS20', type: 'pct', valeur: 20, prixInitial: 2500, prixFinal: 2000, devise: 'XAF', gratuit: false };

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const habiller = (el: React.ReactElement) => <SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair">{el}</ThemeProvider></SafeAreaProvider>;
const monter = (el: React.ReactElement) => render(habiller(el));
// Passer d'un écran à l'autre : on remplace l'arbre (le démontage manuel dérègle les rendus suivants de RNTL).
const aller = async (vue: Awaited<ReturnType<typeof monter>>, el: React.ReactElement) => vue.rerender(habiller(el));
const p = fr.paiement.promo;

const saisirEtAppliquer = async (code: string) => {
  await fireEvent.press(await screen.findByRole('button', { name: p.lien }));
  await fireEvent.changeText(screen.getByLabelText(p.libelle), code);
  await fireEvent.press(screen.getByRole('button', { name: p.appliquer }));
};

beforeEach(async () => {
  jest.clearAllMocks();
  oublierCodePromo();
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'eleve', niveau: '3e', pays: 'CM', termine: true });
  mockParams = {};
  mockOffres.mockResolvedValue(OFFRES);
  mockAcces.mockResolvedValue(null);
  mockMethodes.mockResolvedValue(CM);
});

describe('code promo sur la liste des Pass (E1)', () => {
  it('départ : le lien est sous le bandeau répétiteur, avant les cartes ; les prix sont normaux', async () => {
    await monter(<Offres />);
    expect(await screen.findByRole('button', { name: p.lien })).toBeTruthy();
    expect(screen.getAllByRole('radio').length).toBe(4);
    expect(screen.getByLabelText(/Pass mois, 2.500 FCFA/)).toBeTruthy();
    const arbre = JSON.stringify(screen.toJSON());
    expect(arbre.indexOf(p.lien)).toBeLessThan(arbre.indexOf(fr.offres.gratuitAide));
  });

  it('code appliqué : chaque Pass payant montre l’ancien prix barré, le nouveau prix et le badge', async () => {
    mockVerifierTous.mockResolvedValue(tous20);
    await monter(<Offres />);
    await saisirEtAppliquer('tous20');
    await waitFor(() => expect(screen.getAllByText('-20 %').length).toBeGreaterThanOrEqual(3));
    expect(screen.getByLabelText(/Pass semaine, 400 FCFA au lieu de 500 FCFA/)).toBeTruthy();
    expect(screen.getByLabelText(/Pass mois, 2.000 FCFA au lieu de 2.500 FCFA/)).toBeTruthy();
    expect(screen.getByLabelText(/Pass concours, 6.000 FCFA au lieu de 7.500 FCFA/)).toBeTruthy();
    expect(screen.getByText(/-20 % sur les Pass payants/)).toBeTruthy();
    expect(mockVerifierTous).toHaveBeenCalledTimes(1);
    expect(mockVerifierTous).toHaveBeenCalledWith(expect.anything(), { code: 'TOUS20', pays: 'CM' });
    expect(suivre).toHaveBeenCalledWith('promo_code_applied', { ecran: 'e1', type: 'pct', nb_pass_valables: 3 });
    expect(lireCodePartage()).toBe('TOUS20');
  });

  it('le bouton Payer suit le Pass choisi et son prix réduit', async () => {
    mockVerifierTous.mockResolvedValue(tous20);
    await monter(<Offres />);
    await saisirEtAppliquer('tous20');
    expect(await screen.findByRole('button', { name: /Payer 2.000 FCFA/ })).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/Pass concours/));
    expect(await screen.findByRole('button', { name: /Payer 6.000 FCFA/ })).toBeTruthy();
  });

  it('code valable pour un seul Pass : les autres portent « Code non valable pour ce Pass » et gardent leur prix', async () => {
    mockVerifierTous.mockResolvedValue(concoursSeul);
    await monter(<Offres />);
    await saisirEtAppliquer('concours');
    expect(await screen.findByLabelText(/Pass concours, 6.750 FCFA au lieu de 7.500 FCFA/)).toBeTruthy();
    expect(screen.getAllByText(p.nonValable)).toHaveLength(2);
    expect(screen.getByLabelText(/Pass mois, 2.500 FCFA au lieu de 3.750 FCFA\. Code non valable pour ce Pass/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Payer 2.500 FCFA/ })).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('promo_code_unusable', { offre: 'month' });
  });

  it('Pass à 0 FCFA choisi : le bouton principal devient « Activer mon Pass »', async () => {
    mockVerifierTous.mockResolvedValue(offertSemaine);
    await monter(<Offres />);
    await saisirEtAppliquer('offert');
    await screen.findAllByText('-500 FCFA');
    await fireEvent.press(screen.getByLabelText(/Pass semaine/));
    expect(await screen.findByRole('button', { name: p.activer })).toBeTruthy();
  });

  it.each([
    ['inconnu', { valide: false, erreur: 'inconnu' }, /Ce code n.existe pas/],
    ['expiré', { valide: false, erreur: 'expire', expireLe: '2026-09-30' }, /Ce code a expiré le 30 sept\./],
    ['épuisé', { valide: false, erreur: 'epuise' }, /maximum de fois/],
    ['trop d’essais', { valide: false, erreur: 'limite' }, /Trop d.essais/],
    ['réseau', { valide: false, erreur: 'reseau' }, /Pas de réseau/],
  ])('erreur « %s » : message, prix normaux, payer reste possible', async (_n, reponse, message) => {
    mockVerifierTous.mockResolvedValue(reponse);
    await monter(<Offres />);
    await saisirEtAppliquer('abcde');
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByLabelText(p.libelle).props.value).toBe('ABCDE');
    expect(screen.getByRole('button', { name: /Payer 2.500 FCFA/ })).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('promo_code_failed', { ecran: 'e1', raison: expect.any(String) });
  });

  it('Retirer : les prix normaux et le lien reviennent, et le code partagé est oublié', async () => {
    mockVerifierTous.mockResolvedValue(tous20);
    await monter(<Offres />);
    await saisirEtAppliquer('tous20');
    await fireEvent.press(await screen.findByRole('button', { name: p.retirerCode.replace('{{code}}', 'TOUS20') }));
    expect(screen.queryByText('-20 %')).toBeNull();
    expect(screen.getByRole('button', { name: p.lien })).toBeTruthy();
    expect(lireCodePartage()).toBe('');
    expect(suivre).toHaveBeenCalledWith('promo_code_removed', { ecran: 'e1' });
  });
});

describe('un seul code partagé entre la liste des Pass et le paiement', () => {
  const appliquerSurE1 = async (reponse: unknown, code: string) => {
    mockVerifierTous.mockResolvedValue(reponse);
    const vue = await monter(<Offres />);
    await saisirEtAppliquer(code);
    await screen.findAllByText(/^-\d+ (%|FCFA)$/);
    mockParams = { offre: 'month' };
    return vue;
  };

  it('saisi sur E1, il arrive déjà appliqué sur E2 (revérifié pour le Pass choisi)', async () => {
    const vue = await appliquerSurE1(tous20, 'tous20');
    mockVerifier.mockResolvedValue(appliqueMois);
    await aller(vue, <PayerPass />);
    expect(await screen.findByRole('button', { name: /Payer 2.000 FCFA/ })).toBeTruthy();
    expect(screen.getByText('TOUS20')).toBeTruthy();
    expect(mockVerifier).toHaveBeenCalledWith(expect.anything(), { code: 'TOUS20', offre: 'month', pays: 'CM' });
  });

  it('E2 : le lien « J’ai un code promo » est juste sous la carte du Pass, avant l’opérateur', async () => {
    mockParams = { offre: 'month' };
    await monter(<PayerPass />);
    await screen.findByRole('button', { name: p.lien });
    const arbre = JSON.stringify(screen.toJSON());
    expect(arbre.indexOf(p.lien)).toBeGreaterThan(-1);
    expect(arbre.indexOf(p.lien)).toBeLessThan(arbre.indexOf(fr.paiement.operateur.toUpperCase()));
  });

  it('retiré sur E2, il disparaît aussi au retour sur E1', async () => {
    const vue = await appliquerSurE1(tous20, 'tous20');
    mockVerifier.mockResolvedValue(appliqueMois);
    await aller(vue, <PayerPass />);
    await fireEvent.press(await screen.findByRole('button', { name: p.retirerCode.replace('{{code}}', 'TOUS20') }));
    mockVerifierTous.mockClear();
    await aller(vue, <Offres />);
    expect(await screen.findByRole('button', { name: p.lien })).toBeTruthy();
    expect(mockVerifierTous).not.toHaveBeenCalled();
  });

  it('E1 : au retour de E2, le code est repris et revérifié pour tous les Pass', async () => {
    const vue = await appliquerSurE1(tous20, 'tous20');
    await aller(vue, <PayerPass />);
    mockVerifierTous.mockClear();
    mockVerifierTous.mockResolvedValue(tous20);
    await aller(vue, <Offres />);
    expect(await screen.findByLabelText(/Pass mois, 2.000 FCFA au lieu de 2.500 FCFA/)).toBeTruthy();
    expect(mockVerifierTous).toHaveBeenCalledTimes(1);
  });

  it('E2 : un code qui n’est plus valable à l’ouverture est retiré sans bruit, avec le message de prix normal rétabli', async () => {
    const vue = await appliquerSurE1(tous20, 'tous20');
    mockVerifier.mockResolvedValue({ valide: false, erreur: 'expire', expireLe: '2026-10-01' });
    await aller(vue, <PayerPass />);
    expect(await screen.findByText(p.plusValable)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Payer 2.500 FCFA/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: p.lien })).toBeTruthy();
    expect(lireCodePartage()).toBe('');
  });

  it('E2 : un code valable pour un autre Pass propose « Choisir le Pass concours »', async () => {
    const vue = await appliquerSurE1(concoursSeul, 'concours');
    mockVerifier.mockResolvedValueOnce({ valide: false, erreur: 'offre', offresValables: ['contest'] });
    await aller(vue, <PayerPass />);
    expect(await screen.findByText(/valable pour le Pass concours, pas pour le Pass mois/)).toBeTruthy();
    expect(screen.getByRole('button', { name: p.choisirOffre.replace('{{offre}}', 'Pass concours') })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Payer 2.500 FCFA/ })).toBeTruthy();
    mockVerifier.mockResolvedValueOnce({ ...appliqueMois, code: 'CONCOURS', prixInitial: 7500, prixFinal: 6750 });
    await fireEvent.press(screen.getByRole('button', { name: p.choisirOffre.replace('{{offre}}', 'Pass concours') }));
    expect(await screen.findByRole('button', { name: /Payer 6.750 FCFA/ })).toBeTruthy();
  });
});
