import { Platform } from 'react-native';

import { iosSimule } from './plateformeDev';

/**
 * Paiement par Mobile Money (pawaPay), prix en FCFA et lien de paiement pour un parent : Android seulement. Apple
 * n'accepte que ses achats intégrés : sur iOS aucune référence à pawaPay, au Mobile Money, aux prix en monnaie locale
 * ni à un paiement externe. Les pass restent présentés ; leur achat intégré (StoreKit) est un chantier à part (voir
 * docs/reprise-photo-2026-10-02.md). Les crédits gratuits fonctionnent partout.
 *
 * Le **web** est ouvert au paiement : les règles d'Apple ne s'y appliquent pas. Le Mobile Money y fonctionne comme sur
 * Android (l'élève valide sur son téléphone), et **Chariow** prend le relais pour les pays que pawaPay ne couvre pas.
 *
 * La simulation « iOS » de la page développeur coupe aussi le Mobile Money, pour reproduire fidèlement l'iPhone.
 */
export const paiementPossible = (os: string = Platform.OS): boolean => !iosSimule() && (os === 'android' || os === 'web');
