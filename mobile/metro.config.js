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

// Treat .svg files as JS components via react-native-svg-transformer so
// brand-mark SVG assets can be imported with the lucide-style API:
//   `import GoogleMapsIcon from '@/assets/icons/google-maps.svg'`
// Pulls .svg out of `assetExts` (default = static asset) and into
// `sourceExts` (parsed by the transformer). Mirrors the recipe in the
// react-native-svg-transformer README.
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
};

const { assetExts, sourceExts } = config.resolver;
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    ...(config.resolver?.extraNodeModules || {}),
    '@poultrymanager/shared': sharedRoot,
    shared: sharedRoot,
  },
  assetExts: assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...sourceExts, 'svg'],
  unstable_enableSymlinks: true,
};

module.exports = withNativeWind(config, { input: './global.css' });
