// Expo dynamic config. Reads EXPO_PUBLIC_GOOGLE_MAPS_API_KEY from the env
// (e.g. mobile/.env file) so the same key drives both the native maps modules
// and the JS-side Places HTTP API used by FarmLocationPicker.
//
// To run locally: add this line to mobile/.env
//   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
//
// Then rebuild the dev client (`npx expo run:ios` or `eas build --profile development`).
//
// We deliberately do NOT ship a literal fallback key — exposing one in the
// public repo would let anyone bill against the project unless the key is
// strictly bundle-id-restricted in Google Cloud Console. Force devs to set
// the env var explicitly so they can't accidentally publish a build with an
// unrestricted key.

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
if (!GOOGLE_MAPS_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '[app.config] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not set. Maps + Places ' +
      'features will be disabled. Add it to mobile/.env and rebuild.'
  );
}

module.exports = {
  expo: {
    name: 'PoultryManager',
    slug: 'poultrymanager',
    version: '1.0.1',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'poultrymanager',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.esteratech.poultrymanager',
      appleTeamId: 'P85JP93QHY',
      config: {
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
      },
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: 'Allow PoultryManager to use the camera to capture receipt and document photos.',
        NSPhotoLibraryUsageDescription: 'Allow PoultryManager to access your photos to attach receipts and documents.',
        NSMicrophoneUsageDescription: 'PoultryManager does not use the microphone.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#f5f8f5',
      },
      package: 'com.esteratech.poultrymanager',
      edgeToEdgeEnabled: true,
      config: {
        googleMaps: {
          apiKey: GOOGLE_MAPS_API_KEY,
        },
      },
    },
    web: {
      bundler: 'metro',
    },
    plugins: [
      'expo-router',
      'expo-font',
      'expo-secure-store',
      'expo-sqlite',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#f5f8f5',
          dark: {
            image: './assets/images/splash-icon.png',
            backgroundColor: '#0b0f0b',
          },
        },
      ],
      [
        'expo-camera',
        {
          cameraPermission: 'Allow PoultryManager to use the camera to capture receipt and document photos.',
          recordAudioAndroid: false,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: '41e0847f-1dbf-4a0b-8230-33d259393096',
      },
    },
  },
};
