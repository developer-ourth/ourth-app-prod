# Over-the-air (OTA) updates

The app uses **EAS Update**. JavaScript and asset changes reach installed apps without a Play Store or App Store release.

**How it reaches users:**
- On launch, the app checks for an update and downloads it in the background.
- It checks again whenever it returns to the foreground (at most every 15 minutes).
- Once an update is downloaded, a **"A new version of OURTH is ready — Restart now"** banner appears ([components/OtaUpdateBanner.tsx](../components/OtaUpdateBanner.tsx)). If the user ignores it, the update applies on the next cold start.

## Setup (once per computer)

```
npm install -g eas-cli
eas login            # use the account that is a member of "developer_ourth"
eas whoami
```

## Publish an update

```
npm run update:production -- --message "Fix checkout button on small screens"
```

- The command first runs `scripts/check-ota-env.js`. It **refuses to publish** unless `.env` has the live https API URL and a live Razorpay key. This matters because `eas update` bundles the app on *your* computer.
- Test first on the preview channel: `npm run update:preview -- --message "..."`. This reaches internal or preview builds only.
- To see what's live: `eas update:list --branch production`.
- To roll back, republish the previous good update: `eas update:republish --group <previous group id>`.

## What OTA can and can't change

| ✅ OTA update is fine | ❌ Needs a new store build |
|---|---|
| Screens, text, styles, images | Adding or upgrading a package with native code (anything needing `pod install` / Gradle) |
| Bug fixes in `app/`, `components/`, `lib/` | Changing `app.json` permissions, plugins, icons, splash, bundle id |
| API calls, validation, navigation | Expo SDK upgrade, Firebase/Sentry native config |

`runtimeVersion` follows the app **version** in `app.json` (currently **1.0.2**). An update only reaches builds with the same version.

**For native changes:**
1. Bump `"version"` in `app.json` (for example to 1.0.3).
2. Run `eas build --profile production --platform all`.
3. Submit to the stores.
4. From then on, `npm run update:production` targets 1.0.3. Users still on 1.0.2 keep the last update made for 1.0.2.

**Never** publish an update that depends on a native change to an older version. Those phones would crash on launch.

## Checking it works on store builds

```
eas build:list --platform android --limit 3
```

The live store build must show **channel `production`** and **runtime version `1.0.2`**. If the channel is empty, that build can't receive updates: make a new production build and release it once.

The local `android/` folder is git-ignored and not used by EAS builds (it has `expo.modules.updates.ENABLED=false`). Ignore it, or delete it and run `npx expo prebuild` if you build locally.
