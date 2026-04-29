# Musika — Panduan Integrasi Capacitor

Dokumentasi ini menjelaskan cara mengonversi Musika PWA menjadi aplikasi native Android/iOS menggunakan Capacitor.

---

## Prasyarat

- Node.js ≥ 18
- pnpm ≥ 8
- Android Studio (untuk Android)
- Xcode ≥ 15 + macOS (untuk iOS)
- Java 17 (untuk Android build)

---

## 1. Instalasi Capacitor

```bash
cd artifacts/music-player

# Instal Capacitor core + CLI
pnpm add @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios

# Instal plugin yang dibutuhkan
pnpm add @capacitor/status-bar @capacitor/splash-screen @capacitor/app \
  @capacitor/preferences @capacitor/network @capacitor/haptics \
  @capacitor/push-notifications @capacitor/local-notifications
```

---

## 2. Inisialisasi Capacitor

```bash
# Di dalam artifacts/music-player
npx cap init "Musika" "com.musika.app" --web-dir "dist/public"
```

Ini akan membuat `capacitor.config.ts` di root `artifacts/music-player`.

---

## 3. Konfigurasi `capacitor.config.ts`

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.musika.app',
  appName: 'Musika',
  webDir: 'dist/public',
  server: {
    // Untuk development: arahkan ke server lokal
    // url: 'http://10.0.2.2:25424',   // Android emulator
    // url: 'http://localhost:25424',   // iOS simulator
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0a0a0a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#121212',
      overlaysWebView: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    buildOptions: {
      releaseType: 'APK',
    },
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: 'always',
    allowsLinkPreview: false,
    scrollEnabled: true,
  },
};

export default config;
```

---

## 4. Build & Sync

```bash
# Build Vite terlebih dahulu
pnpm --filter @workspace/music-player run build

# Sync ke platform native
npx cap sync android
npx cap sync ios
```

---

## 5. Menambah Platform

### Android
```bash
npx cap add android
npx cap open android  # Buka di Android Studio
```

### iOS (hanya macOS)
```bash
npx cap add ios
npx cap open ios      # Buka di Xcode
```

---

## 6. Konfigurasi Android

### `android/app/src/main/AndroidManifest.xml`
Tambahkan permission berikut sebelum tag `</manifest>`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.VIBRATE" />

<!-- Untuk media playback di background -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
```

Tambahkan atribut pada `<application>`:
```xml
<application
  android:label="Musika"
  android:icon="@mipmap/ic_launcher"
  android:roundIcon="@mipmap/ic_launcher_round"
  android:supportsRtl="true"
  android:theme="@style/AppTheme"
  android:usesCleartextTraffic="false">
```

---

## 7. Ikon & Splash Screen

### Ikon (Android)
Tempatkan ikon di:
- `android/app/src/main/res/mipmap-hdpi/ic_launcher.png` (72×72)
- `android/app/src/main/res/mipmap-mdpi/ic_launcher.png` (48×48)
- `android/app/src/main/res/mipmap-xhdpi/ic_launcher.png` (96×96)
- `android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png` (144×144)
- `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` (192×192)

Gunakan ikon dari: `https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/musika/logonobglatar121212.png`

### Splash Screen (Android)
```bash
# Gunakan @capacitor/assets untuk generate otomatis
pnpm add -D @capacitor/assets
npx capacitor-assets generate --android
```

---

## 8. Penggunaan Plugin di Kode React

### Network Detection
```typescript
import { Network } from '@capacitor/network';

// Cek status jaringan
const status = await Network.getStatus();
console.log('Online:', status.connected);

// Listen perubahan jaringan
Network.addListener('networkStatusChange', status => {
  console.log('Network status changed:', status.connected);
});
```

### Haptic Feedback
```typescript
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// Saat tombol play ditekan
await Haptics.impact({ style: ImpactStyle.Light });

// Saat aksi penting
await Haptics.impact({ style: ImpactStyle.Medium });
```

### App State (background/foreground)
```typescript
import { App } from '@capacitor/app';

App.addListener('appStateChange', ({ isActive }) => {
  if (!isActive) {
    // App masuk background — simpan state player
    console.log('App went to background');
  }
});

// Tangani tombol back Android
App.addListener('backButton', ({ canGoBack }) => {
  if (!canGoBack) {
    App.exitApp();
  } else {
    window.history.back();
  }
});
```

### Local Notifications (Sleep Timer)
```typescript
import { LocalNotifications } from '@capacitor/local-notifications';

// Notifikasi sleep timer
await LocalNotifications.schedule({
  notifications: [{
    title: 'Musika',
    body: 'Sleep timer selesai — musik dijeda',
    id: 1,
    schedule: { at: new Date(Date.now() + sleepTimerMs) },
    sound: undefined,
    smallIcon: 'ic_stat_musika',
  }]
});
```

---

## 9. Build Release APK

```bash
# Di Android Studio: Build > Generate Signed Bundle / APK
# Atau via command line:
cd android
./gradlew assembleRelease

# APK tersedia di:
# android/app/build/outputs/apk/release/app-release.apk
```

---

## 10. Build ke Google Play Store

1. Buat keystore:
```bash
keytool -genkey -v -keystore musika.keystore \
  -alias musika -keyalg RSA -keysize 2048 -validity 10000
```

2. Konfigurasi `android/app/build.gradle`:
```gradle
android {
  signingConfigs {
    release {
      storeFile file("musika.keystore")
      storePassword "password_kamu"
      keyAlias "musika"
      keyPassword "password_kamu"
    }
  }
  buildTypes {
    release {
      signingConfig signingConfigs.release
      minifyEnabled true
      proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
  }
}
```

3. Build AAB untuk Play Store:
```bash
./gradlew bundleRelease
# AAB: android/app/build/outputs/bundle/release/app-release.aab
```

---

## 11. Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Layar putih saat launch | Pastikan `webDir` sudah benar di `capacitor.config.ts` |
| API tidak bisa diakses | Gunakan URL absolut API (misalnya `musika-api.replit.app`) bukan localhost |
| Audio tidak bisa diputar di background | Tambahkan `FOREGROUND_SERVICE_MEDIA_PLAYBACK` permission |
| Ikon tidak muncul | Re-generate ikon dengan `@capacitor/assets` |
| Crash saat rotate | Tambahkan `android:configChanges` di AndroidManifest |
| CORS error | Pastikan API mengizinkan semua origin atau origin `capacitor://localhost` |

---

## 12. Catatan Penting

- **Audio Background**: Web Audio API di WebView Android memerlukan `<audio>` tag yang sudah ada di DOM. Musika menggunakan pendekatan ini sehingga kompatibel.
- **Offline Mode**: Musika sudah mendukung SW (Service Worker) melalui Vite PWA plugin. Capacitor akan memanfaatkan cache SW secara otomatis.
- **Deep Links**: Konfigurasi `intentFilters` di AndroidManifest untuk handle `musika://` deep links.
- **API URL**: Ganti `import.meta.env.BASE_URL` menjadi URL absolut produksi (`https://musika-api.replit.app`) saat build untuk Capacitor.

---

**GitHub**: [akaanakbaik/musika](https://github.com/akaanakbaik/musika)  
**Web App**: [musika-one.vercel.app](https://musika-one.vercel.app)  
**API**: [musika-api.replit.app](https://musika-api.replit.app)
