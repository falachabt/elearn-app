import { Platform } from 'react-native';

import { iosSimule } from './plateformeDev';

/**
 * Paiement par Mobile Money (pawaPay), prix en FCFA et lien de paiement pour un parent : Android seulement. Apple
 * n'accepte que ses achats intégrés : sur iOS aucune référence à pawaPay, au Mobile Money, aux prix en monnaie locale
 * ni à un paiement externe. Les pass restent présentés ; leur achat intégré (StoreKit) est un chantier à part (voir
 * docs/reprise-photo-2026-10-02.md). Les crédits gratuits fonctionnent partout.
 *
 * La simulation « iOS » de la page développeur coupe aussi le Mobile Money, pour reproduire fidèlement l'iPhone.
 */
export const paiementPossible = (os: string = Platform.OS): boolean => os === 'android' && !iosSimule();
