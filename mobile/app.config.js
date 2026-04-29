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
    version: '1.0.5',
    // Required by expo-updates so Updates.reloadAsync() (used by the
    // language switcher to apply RTL layout changes mid-session) can
    // initialise. We pin to the app's `version` so OTA channels stay
    // tightly coupled to a specific JS bundle / native binary pair —
    // expo-updates throws "configuration object must include a valid
    // runtime version" without it.
    runtimeVersion: {
      policy: 'appVersion',
    },
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
          // iOS keeps the wordmarked 1024×1024 splash — the native
          // LaunchScreen storyboard draws it un-clipped. `imageWidth`
          // gives the wordmark room to breathe at standard phone widths
          // without dominating the canvas. The dark variant is a
          // near-white silhouette designed to sit on the brand
          // dark-green background (#0d3b22 ≈ the top colour of the
          // hero gradient, hsl(148, 65%, 14%)).
          image: './assets/images/splash-light.png',
          imageWidth: 280,
          resizeMode: 'contain',
          backgroundColor: '#f5f8f5',
          dark: {
            image: './assets/images/splash-dark.png',
            backgroundColor: '#0d3b22',
          },
          // Android 12+ renders `windowSplashScreenAnimatedIcon` inside
          // a 288dp canvas and clips anything outside the central
          // ~192dp circle — which chopped off the "PoultryManager.io"
          // wordmark in the iOS asset (test users saw just a row of
          // dots under the logo). The Android splash therefore uses
          // logo-only PNGs whose artwork sits inside a 60% safe square
          // so the full gear-and-chicken mark fits the visible circle.
          android: {
            image: './assets/images/splash-android-light.png',
            imageWidth: 220,
            resizeMode: 'contain',
            backgroundColor: '#f5f8f5',
            dark: {
              image: './assets/images/splash-android-dark.png',
              backgroundColor: '#0d3b22',
            },
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
