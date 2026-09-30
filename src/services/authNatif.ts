import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import type { DepsApple, DepsOAuth } from './compte';

WebBrowser.maybeCompleteAuthSession();

/** Colle OAuth web (Google) : `expo-web-browser` ouvre la page Supabase et récupère le retour sur `elearnprepa://auth/callback`. */
export function depsOAuth(): DepsOAuth {
  return {
    urlRedirection: Linking.createURL('auth/callback'),
    ouvrirNavigateur: (url, redirection) => WebBrowser.openAuthSessionAsync(url, redirection),
  };
}

/** Apple : iOS seulement ; nonce aléatoire (expo-crypto), son empreinte SHA-256 va à Apple et le nonce brut à Supabase. */
export function depsApple(): DepsApple {
  return {
    disponible: async () => Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync()),
    demander: async () => {
      const nonce = Crypto.randomUUID();
      const empreinte = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
      const identifiant = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce: empreinte,
      });
      return { identityToken: identifiant.identityToken, nonce };
    },
  };
}

export const appleAffiche = Platform.OS === 'ios';
