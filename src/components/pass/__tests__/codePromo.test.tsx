import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { fr } from '@/i18n/fr';
import { suivre } from '@/services/analytics';
import { ErreurPaiement } from '@/services/paiementPass';
import { enregistrerProfil } from '@/services/profil';
import { ThemeProvider } from '@/theme/ThemeProvider';

import { oublierCodePromo } from '../useCodePromo';
import { PayerPass } from '../PayerPass';

const mockMethodes = jest.fn();
const mockPayer = jest.fn();
const mockSuivre = jest.fn();
const mockActiver = jest.fn();
const mockStatut = jest.fn();
const mockVerifier = jest.fn();
const mockParams: { offre: string } = { offre: 'month' };
const mockReseau = { estEnLigne: true };
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }, useLocalSearchParams: () => mockParams }));
jest.mock('@/services/analytics', () => ({ suivre: jest.fn() }));
jest.mock('@/services/supabase', () => ({ getSupabase: () => ({ rpc: jest.fn(async () => ({ data: 'cancelled', error: null })) }) }));
jest.mock('@/session/CreditsProvider', () => ({ useCredits: () => ({ rafraichir: jest.fn(async () => {}) }) }));
jest.mock('@/components/reseau/useReseau', () => ({ useReseau: () => mockReseau }));
jest.mock('@/services/codePromo', () => ({ ...jest.requireActual('@/services/codePromo'), verifierCodePromo: (...a: unknown[]) => mockVerifier(...a) }));
jest.mock('@/services/paiementPass', () => {
  const actuel = jest.requireActual('@/services/paiementPass');
  return {
    ...actuel,
    modeEssai: () => false,
    lireMethodes: (...a: unknown[]) => mockMethodes(...a),
    lirePaysPaiement: async () => [{ alpha2: 'SN', name: 'Sénégal', flag: null, prefix: '221', currencies: ['XOF'] }],
    payerMobileMoney: (...a: unknown[]) => mockPayer(...a),
    activerPassGratuit: (...a: unknown[]) => mockActiver(...a),
    lireStatutCommande: (...a: unknown[]) => mockStatut(...a),
    suivreCommande: (...a: unknown[]) => mockSuivre(...a),
    annulerCommande: async () => 'echoue',
  };
});

const CM = {
  payable: true, country: 'CM', countryName: 'Cameroun', prefix: '237', currency: 'XAF',
  offers: [
    { code: 'week', amount: 500, currency: 'XAF', converted: false, recommended: false, durationDays: 7 },
    { code: 'month', amount: 2500, currency: 'XAF', converted: false, recommended: true, durationDays: 30 },
    { code: 'contest', amount: 7500, currency: 'XAF', converted: false, recommended: false, durationDays: 180 },
  ],
  providers: [{ provider: 'MTN_MOMO_CMR', name: 'MTN MoMo', logo: 'https://x/mtn.png', available: true, currency: 'XAF', min: 100, max: 1000000, authType: 'PROVIDER_AUTH', pinPrompt: 'AUTOMATIC', delayed: false }],
};
const pct20 = { valide: true, code: 'ELEARN20', type: 'pct', valeur: 20, prixInitial: 2500, prixFinal: 2000, devise: 'XAF', gratuit: false };
const fixe500 = { valide: true, code: 'MOINS500', type: 'fixe', valeur: 500, prixInitial: 2500, prixFinal: 2000, devise: 'XAF', gratuit: false };
const offert = { valide: true, code: 'OFFERT', type: 'fixe', valeur: 500, prixInitial: 500, prixFinal: 0, devise: 'XAF', gratuit: true };

const metriques = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } };
const monter = (reglage: 'clair' | 'sombre' = 'clair') => render(<SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage={reglage}><PayerPass /></ThemeProvider></SafeAreaProvider>);
const p = fr.paiement.promo;
// Remonte l'écran de zéro (clé différente) pour simuler une sortie puis un retour sur E2 dans la même session.
const racine = (cle: number) => <SafeAreaProvider initialMetrics={metriques}><ThemeProvider reglage="clair"><PayerPass key={cle} /></ThemeProvider></SafeAreaProvider>;

const ouvrir = async () => {
  await screen.findByText('MTN MoMo');
  await fireEvent.press(screen.getByRole('button', { name: p.lien }));
  return screen.getByLabelText(p.libelle);
};
const saisirEtAppliquer = async (code: string) => {
  const champ = await ouvrir();
  await fireEvent.changeText(champ, code);
  await fireEvent.press(screen.getByRole('button', { name: p.appliquer }));
};

beforeEach(async () => {
  jest.clearAllMocks();
  oublierCodePromo();
  await AsyncStorage.clear();
  await enregistrerProfil({ type: 'eleve', niveau: '3e', pays: 'CM', termine: true });
  mockMethodes.mockResolvedValue(CM);
  mockParams.offre = 'month';
  mockReseau.estEnLigne = true;
});

describe('code promo : saisie et vérification', () => {
  it('départ : E2 inchangé avec le lien « J’ai un code promo » et le prix plein', async () => {
    await monter();
    await screen.findByText('MTN MoMo');
    expect(screen.getByRole('button', { name: p.lien })).toBeTruthy();
    expect(screen.getAllByText(/2.500 FCFA/).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(p.libelle)).toBeNull();
  });

  it('ouvrir le champ : lien remplacé, « Appliquer » grisé tant que c’est vide, « Annuler » rend le lien', async () => {
    await monter();
    const champ = await ouvrir();
    expect(champ).toBeTruthy();
    expect(screen.queryByRole('button', { name: p.lien })).toBeNull();
    expect(screen.getByRole('button', { name: p.appliquer }).props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(champ, 'x');
    expect(screen.getByRole('button', { name: p.appliquer }).props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: p.annuler }));
    expect(screen.getByRole('button', { name: p.lien })).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('promo_code_opened', { ecran: 'e2' });
  });

  it('le texte est mis en majuscules, sans espace ni caractère interdit, 20 caractères au plus', async () => {
    await monter();
    const champ = await ouvrir();
    await fireEvent.changeText(champ, ' elearn 20_!');
    expect(screen.getByLabelText(p.libelle).props.value).toBe('ELEARN20');
    await fireEvent.changeText(champ, 'a'.repeat(30));
    expect(screen.getByLabelText(p.libelle).props.value).toHaveLength(20);
  });

  it('vérification : « Vérification » pendant la requête, une seule requête même au double appui', async () => {
    let fin: (v: unknown) => void = () => {};
    mockVerifier.mockReturnValue(new Promise((r) => { fin = r; }));
    await monter();
    const champ = await ouvrir();
    await fireEvent.changeText(champ, 'elearn20');
    const bouton = screen.getByRole('button', { name: p.appliquer });
    await fireEvent.press(bouton);
    await fireEvent.press(bouton);
    expect(mockVerifier).toHaveBeenCalledTimes(1);
    expect(screen.getByText(p.verification)).toBeTruthy();
    expect(screen.getByLabelText(p.libelle).props.editable).toBe(false);
    fin(pct20);
    await screen.findByText('-20 %');
  });

  it('la touche OK du clavier applique le code', async () => {
    mockVerifier.mockResolvedValue(pct20);
    await monter();
    const champ = await ouvrir();
    await fireEvent.changeText(champ, 'ELEARN20');
    await fireEvent(champ, 'submitEditing');
    await screen.findByText('-20 %');
    expect(mockVerifier).toHaveBeenCalledWith(expect.anything(), { code: 'ELEARN20', offre: 'month', pays: 'CM' });
  });
});

describe('code promo : appliqué', () => {
  it('pourcentage : prix de départ barré, nouveau prix, badge « -20 % », économie, carte du code, bouton Payer au prix réduit', async () => {
    mockVerifier.mockResolvedValue(pct20);
    await monter();
    await saisirEtAppliquer('elearn20');
    expect(await screen.findByText('-20 %')).toBeTruthy();
    expect(screen.getByText('ELEARN20')).toBeTruthy();
    expect(screen.getByText(/-20 % sur le Pass mois/)).toBeTruthy();
    expect(screen.getByText(/Tu économises 500 FCFA/)).toBeTruthy();
    expect(screen.getByLabelText(/Prix 2.000 FCFA au lieu de 2.500 FCFA/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Payer 2.000 FCFA/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: p.retirerCode.replace('{{code}}', 'ELEARN20') })).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('promo_code_applied', { ecran: 'e2', type: 'pct', nb_pass_valables: 1 });
  });

  it('montant fixe : badge « -500 FCFA »', async () => {
    mockVerifier.mockResolvedValue(fixe500);
    await monter();
    await saisirEtAppliquer('moins500');
    expect(await screen.findByText(/^-500.FCFA$/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Payer 2.000 FCFA/ })).toBeTruthy();
  });

  it('Retirer : sans confirmation, le prix de départ et le lien reviennent', async () => {
    mockVerifier.mockResolvedValue(pct20);
    await monter();
    await saisirEtAppliquer('elearn20');
    await screen.findByText('-20 %');
    await fireEvent.press(screen.getByRole('button', { name: p.retirerCode.replace('{{code}}', 'ELEARN20') }));
    expect(screen.queryByText('-20 %')).toBeNull();
    expect(screen.getByRole('button', { name: p.lien })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Payer 2.500 FCFA/ })).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('promo_code_removed', { ecran: 'e2' });
  });

  it('le texte du code n’est jamais envoyé à PostHog', async () => {
    mockVerifier.mockResolvedValue(pct20);
    await monter();
    await saisirEtAppliquer('elearn20');
    await screen.findByText('-20 %');
    expect(JSON.stringify((suivre as jest.Mock).mock.calls)).not.toMatch(/ELEARN20/i);
  });
});

describe('code promo : changement de pays', () => {
  it('le code appliqué est revérifié pour le nouveau pays, et refusé si le serveur le refuse', async () => {
    mockVerifier.mockResolvedValueOnce(pct20);
    await monter();
    await saisirEtAppliquer('elearn20');
    await screen.findByText('-20 %');
    mockVerifier.mockResolvedValueOnce({ valide: false, erreur: 'offre' });
    await fireEvent.press(screen.getByRole('button', { name: fr.paiement.changerPays }));
    await fireEvent.press(await screen.findByLabelText('Sénégal'));
    await waitFor(() => expect(mockVerifier).toHaveBeenCalledTimes(2));
    expect(mockVerifier).toHaveBeenLastCalledWith(expect.anything(), { code: 'ELEARN20', offre: 'month', pays: 'SN' });
    expect(await screen.findByText(/Ce code n.est pas valable pour le Pass mois/)).toBeTruthy();
  });
});

describe('code promo : session et thème', () => {
  it('rouvrir l’écran de paiement : le code appliqué est revérifié pour l’offre du moment', async () => {
    mockVerifier.mockResolvedValue(pct20);
    const vue = await render(racine(1));
    await saisirEtAppliquer('elearn20');
    await screen.findByText('-20 %');
    mockParams.offre = 'contest';
    mockVerifier.mockResolvedValue({ ...pct20, prixInitial: 7500, prixFinal: 6000 });
    await vue.rerender(racine(2));
    expect(await screen.findByRole('button', { name: /Payer 6.000 FCFA/ })).toBeTruthy();
    expect(mockVerifier).toHaveBeenLastCalledWith(expect.anything(), { code: 'ELEARN20', offre: 'contest', pays: 'CM' });
  });

  it('après Retirer, rouvrir l’écran ne remet pas le code', async () => {
    mockVerifier.mockResolvedValue(pct20);
    const vue = await render(racine(1));
    await saisirEtAppliquer('elearn20');
    await screen.findByText('-20 %');
    await fireEvent.press(screen.getByRole('button', { name: p.retirerCode.replace('{{code}}', 'ELEARN20') }));
    mockVerifier.mockClear();
    await vue.rerender(racine(2));
    await screen.findByText('MTN MoMo');
    expect(screen.getByRole('button', { name: p.lien })).toBeTruthy();
    expect(mockVerifier).not.toHaveBeenCalled();
  });

  it('thème sombre : l’état appliqué et l’erreur s’affichent', async () => {
    mockVerifier.mockResolvedValueOnce(pct20);
    await monter('sombre');
    await saisirEtAppliquer('elearn20');
    expect(await screen.findByText('-20 %')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: p.retirerCode.replace('{{code}}', 'ELEARN20') }));
    mockVerifier.mockResolvedValueOnce({ valide: false, erreur: 'inconnu' });
    await fireEvent.press(screen.getByRole('button', { name: p.lien }));
    await fireEvent.changeText(screen.getByLabelText(p.libelle), 'zzz');
    await fireEvent.press(screen.getByRole('button', { name: p.appliquer }));
    expect(await screen.findByText(/Ce code n.existe pas/)).toBeTruthy();
  });
});

describe('code promo : les six erreurs', () => {
  const cas: [string, Record<string, unknown>, RegExp][] = [
    ['inconnu', { valide: false, erreur: 'inconnu' }, /Ce code n.existe pas\. Vérifie les lettres et réessaie\./],
    ['expiré, avec la date du serveur', { valide: false, erreur: 'expire', expireLe: '2026-09-30' }, /Ce code a expiré le 30 sept\./],
    ['épuisé', { valide: false, erreur: 'epuise' }, /Ce code a déjà été utilisé le maximum de fois\./],
    ['autre offre', { valide: false, erreur: 'offre', offresValables: ['contest'] }, /Ce code est valable pour le Pass concours, pas pour le Pass mois\./],
    ['trop d’essais', { valide: false, erreur: 'limite' }, /Trop d.essais\. Réessaie dans 1 minute\./],
    ['compte requis', { valide: false, erreur: 'compte_requis' }, /Connecte-toi avec ton compte/],
  ];
  it.each(cas)('%s : message, texte conservé, Payer au prix normal reste possible', async (_nom, reponse, message) => {
    mockVerifier.mockResolvedValue(reponse);
    await monter();
    await saisirEtAppliquer('abcde');
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByLabelText(p.libelle).props.value).toBe('ABCDE');
    expect(screen.getByRole('button', { name: /Payer 2.500 FCFA/ })).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('promo_code_failed', { ecran: 'e2', raison: expect.any(String) });
  });

  it('l’erreur disparaît dès que le texte change', async () => {
    mockVerifier.mockResolvedValue({ valide: false, erreur: 'inconnu' });
    await monter();
    await saisirEtAppliquer('abcde');
    await screen.findByText(/Ce code n.existe pas/);
    await fireEvent.changeText(screen.getByLabelText(p.libelle), 'abcdf');
    expect(screen.queryByText(/Ce code n.existe pas/)).toBeNull();
  });

  it('autre offre : « Choisir le Pass concours » change l’offre et revérifie le code pour elle', async () => {
    mockVerifier.mockResolvedValueOnce({ valide: false, erreur: 'offre', offresValables: ['contest'] });
    await monter();
    await saisirEtAppliquer('concours');
    await screen.findByText(/valable pour le Pass concours/);
    mockVerifier.mockResolvedValueOnce({ ...pct20, code: 'CONCOURS', prixInitial: 7500, prixFinal: 6000 });
    await fireEvent.press(screen.getByRole('button', { name: p.choisirOffre.replace('{{offre}}', 'Pass concours') }));
    expect(mockVerifier).toHaveBeenLastCalledWith(expect.anything(), { code: 'CONCOURS', offre: 'contest', pays: 'CM' });
    expect(mockVerifier).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole('button', { name: /Payer 6.000 FCFA/ })).toBeTruthy();
  });

  it('pas de réseau : message avec « Réessayer », le texte reste', async () => {
    mockVerifier.mockResolvedValueOnce({ valide: false, erreur: 'reseau' });
    await monter();
    await saisirEtAppliquer('elearn20');
    expect(await screen.findByText(p.erreurs.reseau)).toBeTruthy();
    expect(screen.getByLabelText(p.libelle).props.value).toBe('ELEARN20');
    mockVerifier.mockResolvedValueOnce(pct20);
    await fireEvent.press(screen.getByRole('button', { name: p.reessayer }));
    expect(await screen.findByText('-20 %')).toBeTruthy();
  });

  it('hors ligne : refus tout de suite, aucune requête', async () => {
    mockReseau.estEnLigne = false;
    await monter();
    await saisirEtAppliquer('elearn20');
    expect(await screen.findByText(p.erreurs.reseau)).toBeTruthy();
    expect(mockVerifier).not.toHaveBeenCalled();
  });
});

describe('code promo : paiement', () => {
  it('Mobile Money : le code appliqué part avec la commande, le reçu rappelle prix barré, code et montant payé', async () => {
    mockVerifier.mockResolvedValue(pct20);
    mockPayer.mockResolvedValue({ statut: 'en_attente', commande: 'c1', pinPrompt: 'AUTOMATIC' });
    mockSuivre.mockResolvedValue({ statut: 'reussi', commande: 'c1', recu: 'EP-AB12-0001', finPass: '2026-11-30T00:00:00Z' });
    await monter();
    await saisirEtAppliquer('elearn20');
    await screen.findByText('-20 %');
    await fireEvent.changeText(screen.getByLabelText(fr.paiement.numero), '653456789');
    await fireEvent.press(screen.getByRole('button', { name: /Payer 2.000 FCFA/ }));
    await waitFor(() => expect(mockPayer).toHaveBeenCalled());
    expect(mockPayer.mock.calls[0][1]).toMatchObject({ offre: 'month', pays: 'CM', promo: 'ELEARN20' });
    expect(mockPayer.mock.calls[0][1]).not.toHaveProperty('montant');
    expect(await screen.findByText(p.recuPrix)).toBeTruthy();
    expect(screen.getByText(p.recuCode.replace('{{code}}', 'ELEARN20'))).toBeTruthy();
    expect(screen.getByText('-20 %')).toBeTruthy();
    expect(screen.getByText(p.recuPaye)).toBeTruthy();
    expect(screen.getByText(/2.000 FCFA/)).toBeTruthy();
    expect(screen.getByText('EP-AB12-0001')).toBeTruthy();
  });

  it('sans code : le paiement ne porte aucun code et le reçu reste inchangé', async () => {
    mockPayer.mockResolvedValue({ statut: 'en_attente', commande: 'c1', pinPrompt: 'AUTOMATIC' });
    mockSuivre.mockResolvedValue({ statut: 'reussi', commande: 'c1', recu: 'EP-0', finPass: '2026-11-30T00:00:00Z' });
    await monter();
    await screen.findByText('MTN MoMo');
    await fireEvent.changeText(screen.getByLabelText(fr.paiement.numero), '653456789');
    await fireEvent.press(screen.getByRole('button', { name: /Payer 2.500 FCFA/ }));
    await waitFor(() => expect(mockPayer).toHaveBeenCalled());
    expect(mockPayer.mock.calls[0][1].promo).toBeUndefined();
    expect(await screen.findByText(fr.paiement.montant)).toBeTruthy();
    expect(screen.queryByText(p.recuPrix)).toBeNull();
  });

  it('code refusé par le serveur au moment de payer : retour au champ en erreur, rien n’est parti chez l’opérateur', async () => {
    mockVerifier.mockResolvedValue(pct20);
    mockPayer.mockRejectedValue(new ErreurPaiement('promo', 'Ce code a expiré.', undefined, undefined, 'expire'));
    await monter();
    await saisirEtAppliquer('elearn20');
    await screen.findByText('-20 %');
    await fireEvent.changeText(screen.getByLabelText(fr.paiement.numero), '653456789');
    await fireEvent.press(screen.getByRole('button', { name: /Payer 2.000 FCFA/ }));
    expect(await screen.findByText(p.erreurs.expireSansDate)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Payer 2.500 FCFA/ })).toBeTruthy();
    expect(screen.queryByText(fr.paiement.attenteTitre)).toBeNull();
  });
});

describe('code promo : pass à 0 FCFA', () => {
  beforeEach(() => {
    mockParams.offre = 'week';
    mockVerifier.mockResolvedValue(offert);
  });

  it('plus d’opérateur ni de numéro : carte « Rien à payer », bouton « Activer mon Pass », pas de « Demander à quelqu’un »', async () => {
    await monter();
    await saisirEtAppliquer('offert');
    expect(await screen.findByText(p.gratuitTitre)).toBeTruthy();
    expect(screen.getByText(p.gratuitTexte.replace('{{offre}}', 'Pass semaine'))).toBeTruthy();
    expect(screen.queryByLabelText(fr.paiement.numero)).toBeNull();
    expect(screen.queryByText('MTN MoMo')).toBeNull();
    expect(screen.getByRole('button', { name: p.activer })).toBeTruthy();
    expect(screen.queryByRole('button', { name: fr.paiement.demanderPayer })).toBeNull();
    expect(screen.getByText(p.activation)).toBeTruthy();
    expect(suivre).toHaveBeenCalledWith('promo_code_applied', { ecran: 'e2', type: 'fixe', nb_pass_valables: 1 });
  });

  it('« Activer mon Pass » : aucune demande Mobile Money, le pass s’active et le reçu montre 0 FCFA et le code', async () => {
    mockActiver.mockResolvedValue({ statut: 'reussi', commande: 'g1', montant: 0, devise: 'XAF' });
    mockStatut.mockResolvedValue({ statut: 'reussi', commande: 'g1', recu: 'EP-FREE-0001', finPass: '2026-10-14T00:00:00Z' });
    await monter();
    await saisirEtAppliquer('offert');
    await fireEvent.press(await screen.findByRole('button', { name: p.activer }));
    await waitFor(() => expect(mockActiver).toHaveBeenCalled());
    expect(mockActiver.mock.calls[0][1]).toMatchObject({ offre: 'week', pays: 'CM', promo: 'OFFERT' });
    expect(mockPayer).not.toHaveBeenCalled();
    expect(await screen.findByText(p.recuCode.replace('{{code}}', 'OFFERT'))).toBeTruthy();
    expect(screen.getByText(/^0 FCFA$/)).toBeTruthy();
    expect(screen.getByText('EP-FREE-0001')).toBeTruthy();
    expect(screen.queryByText(fr.paiement.operateurRecu)).toBeNull();
  });

  it('activation refusée par le serveur (code épuisé entre-temps) : retour au champ en erreur', async () => {
    mockActiver.mockRejectedValue(new ErreurPaiement('promo', '', undefined, undefined, 'epuise'));
    await monter();
    await saisirEtAppliquer('offert');
    await fireEvent.press(await screen.findByRole('button', { name: p.activer }));
    expect(await screen.findByText(p.erreurs.epuise)).toBeTruthy();
    expect(screen.queryByRole('button', { name: p.activer })).toBeNull();
  });
});
