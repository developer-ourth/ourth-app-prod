const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

/**
 * Custom Expo config plugin to fix React Native Firebase + useFrameworks: "static"
 *
 * Problem: useFrameworks: "static" is required for Firebase Swift pods (FirebaseAuth-Swift.h),
 * but it causes React Native Firebase's Obj-C bridge to fail because it includes
 * non-modular React-Core headers (RCTConvert.h, RCTBridgeModule.h, etc.).
 *
 * Fix: Set ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES for all pod targets
 * so that framework modules are permitted to include non-modular headers.
 */
module.exports = function withFirebaseiOSFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );

      let contents = fs.readFileSync(podfilePath, 'utf8');

      const tag = '@ourth-firebase-ios-fix';

      if (!contents.includes(tag)) {
        const postInstallBlock = `
# ${tag}
# Allows React Native Firebase Obj-C bridge to include React-Core non-modular headers
# when all pods are built as static frameworks (required for Firebase Swift pods).
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end
  end
end
`;
        contents = contents + postInstallBlock;
        fs.writeFileSync(podfilePath, contents);
      }

      return config;
    },
  ]);
};
