const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo config plugin to add 16 KB page size support for Android
 * 
 * This is required by Google Play Store to ensure compatibility with
 * devices that use 16 KB memory page sizes.
 * 
 * Reference: https://developer.android.com/guide/practices/page-sizes
 */
const withAndroid16KBPageSize = (config) => {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    
    // Safety check: ensure application element exists
    if (!manifest.application || !manifest.application[0]) {
      throw new Error('AndroidManifest.xml is missing the application element');
    }
    
    const mainApplication = manifest.application[0];

    // Set extractNativeLibs to false to support 16KB page sizes
    // This ensures native libraries remain compressed in the APK/AAB
    // and are properly aligned for devices with 16KB memory pages
    mainApplication.$['android:extractNativeLibs'] = 'false';

    return config;
  });
};

module.exports = withAndroid16KBPageSize;
