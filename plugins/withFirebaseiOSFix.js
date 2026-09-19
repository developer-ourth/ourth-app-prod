const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

/**
 * Custom Expo config plugin to fix React Native Firebase + useFrameworks: "static"
 *
 * PROBLEM:
 *   useFrameworks: "static" is required for Firebase iOS SDK v11+ (Swift-based pods like
 *   FirebaseAuth) to generate their Swift-bridging headers (FirebaseAuth-Swift.h).
 *   However, it causes React Native Firebase's Obj-C bridge code (RNFBApp, RNFBAuth, etc.)
 *   to fail with [-Werror,-Wnon-modular-include-in-framework-module] because they include
 *   non-modular React-Core headers (RCTConvert.h, RCTBridgeModule.h, etc.).
 *
 * FIX:
 *   Set ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES in the Xcode build settings
 *   for all pod targets inside the existing post_install do |installer| block.
 */
module.exports = function withFirebaseiOSFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );

      if (!fs.existsSync(podfilePath)) {
        console.warn('[withFirebaseiOSFix] Podfile not found at:', podfilePath);
        return config;
      }

      let contents = fs.readFileSync(podfilePath, 'utf8');

      const tag = '@ourth-firebase-ios-fix';

      if (contents.includes(tag)) {
        // Already patched
        return config;
      }

      const fix = `
    # ${tag}
    # Allow Firebase Obj-C bridge to include non-modular React-Core headers
    # when all pods are built as static frameworks (required for Firebase Swift pods).
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        build_config.build_settings['ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
`;

      // Insert right inside post_install do |installer|
      if (contents.includes('post_install do |installer|')) {
        contents = contents.replace(
          'post_install do |installer|',
          'post_install do |installer|' + fix
        );
        fs.writeFileSync(podfilePath, contents);
        console.log('[withFirebaseiOSFix] Successfully inserted fix into post_install do |installer| block.');
      } else {
        console.warn('[withFirebaseiOSFix] Could not find "post_install do |installer|" in Podfile.');
      }

      return config;
    },
  ]);
};
