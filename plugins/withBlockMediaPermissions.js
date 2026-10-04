const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

/**
 * Expo config plugin to block READ_MEDIA permissions from being added to AndroidManifest
 * 
 * This plugin removes READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE, READ_MEDIA_IMAGES,
 * READ_MEDIA_VIDEO, and READ_MEDIA_VISUAL_USER_SELECTED permissions from the manifest.
 * 
 * Background:
 * - Google Play Store rejected the app for using READ_MEDIA_IMAGES/READ_MEDIA_VIDEO permissions
 * - These permissions should only be used for apps with core functionality requiring persistent
 *   broad access to all photos/videos on the device
 * - Our app only needs one-time access for support ticket photo/video uploads
 * - On Android 13+, expo-image-picker automatically uses the Android Photo Picker which
 *   doesn't require these permissions
 * - For Android 12 and below, we use SAF (Storage Access Framework) via the photo picker
 * 
 * Reference: https://developer.android.com/about/versions/13/behavior-changes-13#granular-media-permissions
 * Reference: https://support.google.com/googleplay/android-developer/answer/14115180
 */
const withBlockMediaPermissions = (config) => {
  // First, use AndroidConfig to block permissions at the config level
  config = AndroidConfig.Permissions.withBlockedPermissions(config, [
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE',
    'android.permission.READ_MEDIA_IMAGES',
    'android.permission.READ_MEDIA_VIDEO',
    'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
    'android.permission.READ_MEDIA_AUDIO', // Also block audio just to be safe
  ]);

  // Then, also manually remove them from the manifest as a backup
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    
    // Ensure uses-permission array exists
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    // List of permissions to remove
    const permissionsToRemove = [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
      'android.permission.READ_MEDIA_AUDIO',
    ];

    // Remove the permissions from the manifest
    manifest['uses-permission'] = manifest['uses-permission'].filter(
      (permission) => {
        const permissionName = permission.$?.['android:name'];
        return !permissionsToRemove.includes(permissionName);
      }
    );

    return config;
  });
};

module.exports = withBlockMediaPermissions;
