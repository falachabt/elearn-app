import { Platform } from 'react-native';

/**
 * Achat d'un pass, Mobile Money et lien de paiement pour un parent : Android seulement. Sur iOS l'App Store n'accepte
 * pas un paiement hors de ses achats intégrés (ni les renvois vers un paiement externe) : aucun écran, bouton ni phrase
 * qui parle de pass à acheter, de prix ou de Mobile Money ne doit y apparaître. L'achat intégré Apple est un chantier
 * à part (voir docs/reprise-photo-2026-10-02.md). Les crédits gratuits, eux, fonctionnent partout.
 */
export const paiementPossible = (os: string = Platform.OS): boolean => os === 'android';
