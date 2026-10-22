# Auth Signature

Verification codes for scanned client numbers. Next.js + Neon Postgres.

## Flow

1. **Client** logs in and presses "Get my code". The server creates a random 10-digit number and shows it once, as text and as a Code128 barcode. Only a keyed hash (HMAC-SHA256) is stored, never the number.
2. **Admin** enters the number. The server hashes it and attaches the next verification code (one letter + 5 digits, `A00000`–`Z99999`). Entering the same number again returns the same code.
3. **Monitor** user scans the number with a Zebra scanner (keyboard/HID or DataWedge mode, ends with Enter) and the page shows the verification code.

Verification codes come from a database counter pushed through a bijective map, so none repeats until all 2,600,000 are used; the cycle then restarts. When the next code is still held by an older request (the space is full), the oldest 1000 requests and their codes are deleted to make room, and the same happens each time it fills up. Set `VCODE_PRUNE_BATCH` to change the batch size.

Each request records who asked (`codes.requested_by_email`) and which admin issued the code (`verifications.issued_by_email`); the emails are kept even if the user is deleted later.

## Android app

Download `auth-signature.apk` from the [latest release](https://github.com/SanorSmith/Auth_signiture/releases/latest) on an Android 7.0+ phone, open it and allow installing from that source. It opens the site full-screen as its own app and supports the request notifications. Details and how to rebuild it are in [`android/README.md`](android/README.md).

## Notifications

Everyone has a bell in the header with the notifications meant for them. Each kind has its own 2 to 3 second tone:

| Tone | Who gets it | When |
| --- | --- | --- |
| New request | people who manage requests | a client asked for a code |
| Password reset | people who reset passwords | someone asked for a password reset |
| Code ready | the client | the admin issued their code |
| Request denied | the client | the admin denied their request |
| Request removed | the client | the admin removed their request |
| Access changed | the user | an admin changed their permissions |

Your own actions play short sounds instead: request sent, code found, not found, error, done (generate, save, create, reset) and denied or removed. The tones are loud and stay audible for their whole length; the bell has a **Test sound** button, and if nothing is heard the phone's media volume or silent mode is the next thing to check.

- **In the app:** while it is open it checks every few seconds, plays the tone, vibrates and shows a banner. "Hear the tones" in the bell previews every tone. Browsers only allow sound after one touch on the page, and sound can be switched off per device.
- **On the device:** "Turn on device notifications" subscribes the device to Web Push, so Android shows a notification with the device's own default sound even when the app is closed. It needs the installed app (or Chrome) on a device with Google Play services; where push is unavailable the in-app tones still work.

Notifications are stored in the `notifications` table (the newest 50 per person). They never include the scanned number or the verification code. Push signing keys are created on first use and kept in `app_settings`; set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` to use your own.

## Setup

```
npm install
cp .env.example .env.local   # fill in DATABASE_URL, CODE_HMAC_SECRET, SESSION_SECRET
npm run dev
```

Create the first user (roles: `admin`, `client`, `monitor`); after that, admins create users from the Admin page:

```
node --env-file=.env.local scripts/create-user.mjs admin@example.com 'a-strong-password' admin
```

Keep `CODE_HMAC_SECRET` stable: changing it makes every existing number unrecognisable.

## Schema

`users`, `codes (code_hash)`, `verifications (code_hash, vcode, issue_date)` and the sequence `vcode_counter`.
