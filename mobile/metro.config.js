if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function () {
    return [...this].reverse();
  };
}

const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..');
const sharedRoot = path.resolve(workspaceRoot, 'shared');

const config = getDefaultConfig(__dirname);

config.watchFolders = [...(config.watchFolders || []), sharedRoot];

config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    ...(config.resolver?.extraNodeModules || {}),
    '@poultrymanager/shared': sharedRoot,
    shared: sharedRoot,
  },
  unstable_enableSymlinks: true,
};

module.exports = withNativeWind(config, { input: './global.css' });
