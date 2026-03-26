# Yonderia

Next.js 16 App Router project for the Yonderia group vacation planner.
Available as a web app (Vercel) and native iOS/Android apps via Capacitor.

## Setup

1. Copy `.env.local.example` to `.env.local` and fill in the Supabase and Google API keys.
2. Install dependencies with `npm install`.
3. Start the app with `npm run dev`.

## Scripts

- `npm run dev` — Start Next.js with Turbopack (web only, no Capacitor overhead).
- `npm run build` — Create a production build.
- `npm run start` — Run the production server.
- `npm run lint` — Run ESLint.
- `npm run cap:sync` — Sync web assets and plugins to native projects.
- `npm run cap:open:android` — Open the Android project in Android Studio.
- `npm run cap:open:ios` — Open the iOS project in Xcode.
- `npm run cap:build` — Sync and prompt to open native IDE for building.

## Mobile Development

### Architecture

The native apps use **Capacitor in remote URL mode** — the WebView loads the
production Vercel deployment over HTTPS. This means:

- Full Next.js SSR works (no static export).
- OAuth cookies work correctly over HTTPS.
- No need to rebuild the native app for web-only changes.
- Native features (push notifications, deep links) are added via Capacitor plugins.

### Running Android Locally (Live Reload)

1. Start the Next.js dev server: `npm run dev`
2. Find your LAN IP (e.g., `192.168.1.x`)
3. Set the env and sync:
   ```
   CAPACITOR_SERVER_URL=http://192.168.1.x:3000 npx cap sync android
   ```
4. Open in Android Studio: `npm run cap:open:android`
5. Run on emulator or connected device.

### Building iOS

Since you're on Windows, iOS builds require a Mac (remote or cloud CI):

1. Push your code to GitHub.
2. On a Mac with Xcode installed:
   - Clone the repo and run `npm install`
   - `npx cap sync ios`
   - `npm run cap:open:ios`
   - In Xcode: set your signing team, then build/archive.
3. For TestFlight: Archive in Xcode and upload to App Store Connect.
4. Alternative: use a cloud CI service (GitHub Actions with macOS runner, Codemagic, etc.).

### Push Notifications Setup

#### Firebase (Android + iOS)

1. Create a Firebase project at https://console.firebase.google.com
2. Add an Android app with package name `com.yonderia.app`
3. Download `google-services.json` and place it in `android/app/`
4. Add an iOS app and download `GoogleService-Info.plist` — place it in `ios/App/App/`
5. Set these environment variables on your server:
   - `FCM_SERVER_KEY` — Firebase Cloud Messaging server key
   - `FIREBASE_PROJECT_ID` — Your Firebase project ID
   - `PUSH_NOTIFICATIONS_SECRET` — A shared secret for the internal send-push API

#### Apple Push Notifications (iOS)

1. In Apple Developer portal: enable Push Notifications for your App ID.
2. Create an APNs key (Keys > Create) and upload it to Firebase Console > Cloud Messaging.
3. Add the Push Notifications capability in Xcode.
4. The `ios/App/App/App.entitlements` file is already configured for push.

### Testing Push Notifications in Dev

1. Push notifications require a real device (not simulator).
2. In the app, trigger a notification opt-in flow (e.g., join a trip).
3. Check Supabase `device_tokens` table for the registered token.
4. Send a test push via the API:
   ```bash
   curl -X POST https://yonderia.vercel.app/api/notifications/send-push \
     -H "Authorization: Bearer YOUR_PUSH_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"user_id":"...","title":"Test","body":"Hello from Yonderia!"}'
   ```

### Deep Links / Universal Links

The app handles these URL patterns as deep links:
- `https://yonderia.vercel.app/trip/*/join/*` — Trip invite join
- `https://yonderia.vercel.app/trip/*` — Trip detail
- `https://yonderia.vercel.app/dashboard` — Dashboard

**Android:** Configured in `android/app/src/main/AndroidManifest.xml`. You need to
update `public/.well-known/assetlinks.json` with your signing key SHA-256 fingerprint.

**iOS:** Configured in `ios/App/App/App.entitlements`. Update
`public/.well-known/apple-app-site-association` replacing `TEAM_ID` with your
Apple Developer Team ID.

### App Icons and Splash Screen

Generate native icons from `public/yonderia_logo.jpg`:

```bash
npm install -D @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor '#F0F0F0' --splashBackgroundColor '#F0F0F0'
```

Or manually place icons in:
- Android: `android/app/src/main/res/mipmap-*/`
- iOS: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

### Sign in with Apple (iOS)

Apple requires Sign in with Apple when other social logins are offered.
The button appears automatically on iOS builds.

1. In Apple Developer portal: enable Sign in with Apple for your App ID.
2. In Supabase Dashboard: add Apple as an auth provider with your Service ID and key.
3. Set `NEXT_PUBLIC_APPLE_CLIENT_ID` env var (defaults to `com.yonderia.app`).

### App Store & Play Store Compliance

**Content rating:** Social/Communication app — no mature content, user-generated
text only. Select "Social Networking" category.

**Data safety (Android Play Store):** Declare:
- Account info (name, email) collected for app functionality — not shared.
- Device tokens collected for push notifications — not shared.
- No tracking, no ads, no third-party analytics.

**Apple privacy nutrition labels:** Declare:
- Contact Info (email, name) — used for app functionality.
- Identifiers (device token) — used for push notifications.
- Not used for tracking.

## Environment Variables

See `.env.local.example` for the full list. Additional vars for mobile:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Production URL (used in Capacitor config) |
| `CAPACITOR_SERVER_URL` | Override server URL for dev live-reload |
| `FCM_SERVER_KEY` | Firebase Cloud Messaging server key |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `PUSH_NOTIFICATIONS_SECRET` | Shared secret for send-push API |
| `NEXT_PUBLIC_APPLE_CLIENT_ID` | Apple Sign In client ID (default: com.yonderia.app) |
