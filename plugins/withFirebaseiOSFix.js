const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

/**
 * Custom Expo config plugin to fix React Native Firebase + useFrameworks: "static"
 *
 * PROBLEM:
 *   useFrameworks: "static" is required for Firebase iOS SDK v11+ (FirebaseAuth Swift pods).
 *   However, React Native Firebase's Obj-C headers include non-modular React-Core headers,
 *   causing clang error [-Werror,-Wnon-modular-include-in-framework-module].
 *
 * FIX:
 *   1. Set CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES on the Xcode project.
 *   2. Set CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES on all Pod targets & Aggregate targets.
 *   3. Append -Wno-non-modular-include-in-framework-module to OTHER_CFLAGS for all Pod targets.
 */
module.exports = function withFirebaseiOSFix(config) {
  // 1. Modify Xcode project build settings
  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      if (typeof configurations[key] === 'object' && configurations[key].buildSettings) {
        configurations[key].buildSettings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES';
        configurations[key].buildSettings['ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES';
      }
    }
    return config;
  });

  // 2. Modify Podfile post_install
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
        return config;
      }

      const fix = `
    # ${tag}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        build_config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        build_config.build_settings['ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        cflags = build_config.build_settings['OTHER_CFLAGS'] || '$(inherited)'
        cflags = [cflags] if cflags.is_a?(String)
        cflags << '-Wno-non-modular-include-in-framework-module' unless cflags.include?('-Wno-non-modular-include-in-framework-module')
        build_config.build_settings['OTHER_CFLAGS'] = cflags
      end
    end
    installer.aggregate_targets.each do |target|
      target.user_project.build_configurations.each do |build_config|
        build_config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        build_config.build_settings['ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
`;

      if (contents.includes('post_install do |installer|')) {
        contents = contents.replace(
          'post_install do |installer|',
          'post_install do |installer|' + fix
        );
        fs.writeFileSync(podfilePath, contents);
        console.log('[withFirebaseiOSFix] Successfully inserted non-modular header fix into Podfile.');
      } else {
        console.warn('[withFirebaseiOSFix] Could not find "post_install do |installer|" in Podfile.');
      }

      return config;
    },
  ]);
};
