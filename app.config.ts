import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Complète app.json (qui reste la source de la config native). Deux valeurs dynamiques :
 * - `extra.obligatoire` : vaut true quand UPDATE_OBLIGATOIRE=1 (posé par le workflow eas-preview.yml si le message du
 *   commit contient [obligatoire]) ;
 * - `android.googleServicesFile` : fichier Firebase (notifications push Android) lu dans la variable EAS de type
 *   fichier GOOGLE_SERVICES_JSON, jamais committé (ce dépôt est public). Absente (tests, CI sans EAS), rien n'est
 *   ajouté. Ce fichier est natif : il ne vaut que pour un NOUVEAU build, pas pour une mise à jour OTA.
 * Ni runtimeVersion ni plugins ne sont modifiés ici.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  android: {
    ...config.android,
    ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
  },
  extra: {
    ...config.extra,
    obligatoire: process.env.UPDATE_OBLIGATOIRE === '1',
  },
});
