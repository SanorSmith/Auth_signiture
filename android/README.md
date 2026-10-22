# Android app

The Android app is a Trusted Web Activity: Chrome opens https://auth-signiture.vercel.app full-screen
in its own app window. It always shows the latest version of the site, keeps Web Push notifications
working, and needs no update when the site changes. Only the wrapper is an APK.

## Install on a phone

1. Open the latest release: https://github.com/SanorSmith/Auth_signiture/releases/latest
2. Download `auth-signature.apk` on the phone.
3. Open it. Android asks to allow installing from this source ("Install unknown apps"); allow it for
   the browser or file manager you used, then press Install.
4. Open **Auth Signature**. Sign in as usual. Admins: open the bell and turn on device notifications.

The app needs Chrome (the phone's default on Android). `assetlinks.json` on the site tells Android the
app belongs to the site, which removes the browser address bar.

## Rebuild the APK

`twa-manifest.json` describes the app (name, colours, icons, package `com.authsignature.app`).

1. Install Java 17 and the Android SDK (Android Studio does both).
2. In a folder outside this repo: `npm i @bubblewrap/cli`, copy `twa-manifest.json` there and put the
   signing key at `signing/android.keystore` (alias `authsignature`).
3. `npx bubblewrap update --manifest=./twa-manifest.json --skipVersionUpgrade` generates the project.
4. `gradlew assembleRelease`, then `zipalign` and `apksigner sign` with the keystore.
5. Raise `appVersionCode` in `twa-manifest.json` for every new release.

## The signing key

The APK is signed with a private key that is **not** in this repository. Keep a backup of it. Android only
installs an update over an existing install if it is signed with the same key, so if the key is lost
every user has to uninstall and reinstall. If you ever use a different key, update the SHA-256
fingerprint in `public/.well-known/assetlinks.json` to match.
