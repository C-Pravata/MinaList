import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.mina.app',
  appName: 'Mina',
  webDir: 'dist',
  server: {
    hostname: 'app.mina.io',
    iosScheme: 'http',
    androidScheme: 'http',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#A855F7",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
    },
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    }
  }
};

export default config;