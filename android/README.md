# Android app

Version 2 is a native app (Kotlin, Jetpack Compose, Material 3), not a web wrapper. It talks to the
site's `/api/mobile/*` endpoints and has the same screens as the site: Requests, Scan, Monitor, Users
and Account, shown according to each person's permissions.

- Zebra scanners: the app registers a DataWedge profile and receives scans by broadcast, so the scan
  box fills without a keyboard.
- Notifications: a distinct tone per event, system notifications, and an optional "alerts when the app
  is closed" switch (a small foreground service that checks the server; no Google services needed).
- Same package and signing key as version 1, so it installs over the old web-wrapper app.

## Install on a phone

1. Open https://github.com/SanorSmith/Auth_signiture/releases/latest and download `auth-signature.apk`.
2. Open it, allow "Install unknown apps" for that browser/file manager, press Install.
3. Sign in. On Android 13+ allow notifications when asked.

## Build

Needs JDK 17 and the Android SDK (compileSdk 36). From this folder:

`./gradlew assembleRelease`, then `zipalign -p 4` and `apksigner sign` with the keystore (alias
`authsignature`). Raise `versionCode` in `app/build.gradle.kts` for every release. The old web-wrapper
manifest is kept in `twa/twa-manifest.json`.

## The signing key

The APK is signed with a private key that is **not** in this repository. Keep a backup of it. Android only
installs an update over an existing install if it is signed with the same key, so if the key is lost
every user has to uninstall and reinstall. If you ever use a different key, update the SHA-256
fingerprint in `public/.well-known/assetlinks.json` to match.
