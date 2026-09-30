import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Complète app.json (qui reste la source de la config native). Seul `extra.obligatoire` est dynamique :
 * il vaut true quand UPDATE_OBLIGATOIRE=1 (posé par le workflow eas-preview.yml si le message du commit
 * contient [obligatoire]). Ni runtimeVersion, ni plugins, ni rien de natif n'est modifié ici.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  extra: {
    ...config.extra,
    obligatoire: process.env.UPDATE_OBLIGATOIRE === '1',
  },
});
