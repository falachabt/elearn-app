import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

export type InfosVersion = {
  /** Version de l'app installée (3.0.0). */
  version: string;
  /** Numéro de build du binaire (versionCode Android, CFBundleVersion iOS). */
  build: string | null;
  /** Canal des mises à jour (preview, production) ; null en développement. */
  canal: string | null;
  /** 7 premiers caractères de la mise à jour en cours ; null si l'app tourne sur le code du build. */
  miseAJour: string | null;
  /** Date de la mise à jour en cours. */
  publiee: Date | null;
};

/** Version affichée en bas de Paramètres (demande de Benny) : utile pour savoir quelle OTA est sur le téléphone. */
export function lireVersion(): InfosVersion {
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '?';
  const build = Application.nativeBuildVersion ?? null;
  let canal: string | null = null;
  let miseAJour: string | null = null;
  let publiee: Date | null = null;
  try {
    canal = Updates.channel || null;
    if (Updates.updateId && !Updates.isEmbeddedLaunch) {
      miseAJour = Updates.updateId.slice(0, 7);
      publiee = Updates.createdAt ?? null;
    }
  } catch {
    // expo-updates absent (web, tests) : version seule.
  }
  return { version, build, canal, miseAJour, publiee };
}
