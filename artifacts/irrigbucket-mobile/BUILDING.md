# Building the IrrigBucket APK

This guide walks you through producing a standalone Android APK that testers can install directly on their phones — no Google Play required.

## Prerequisites

- Node.js and pnpm installed
- An Expo account (free — create one at [expo.dev](https://expo.dev))

## Steps

### 1. Create a free Expo account

Go to [expo.dev](https://expo.dev) and sign up for a free account. Note your username — you'll need it in the next step.

### 2. Set your Expo username in app.json

Open `artifacts/irrigbucket-mobile/app.json` and replace the `owner` placeholder with your Expo username:

```json
"owner": "your-expo-username"
```

### 3. Install dependencies from the monorepo root

Make sure all packages are installed. Run this from the **monorepo root** (the folder containing `artifacts/`, `lib/`, `pnpm-workspace.yaml`):

```bash
pnpm install
```

### 4. Log in to EAS

Still from the **monorepo root**:

```bash
pnpm --filter @workspace/irrigbucket-mobile exec eas login
```

Enter your Expo credentials when prompted.

### 5. Start the build

**Important:** Run this from the **monorepo root** — not from inside `artifacts/irrigbucket-mobile`. This is required so EAS can find the `pnpm-lock.yaml` and use pnpm (instead of falling back to npm and installing the wrong package versions).

```bash
pnpm --filter @workspace/irrigbucket-mobile exec eas build --platform android --profile preview
```

EAS will upload the project to Expo's build servers and compile a native APK. The first build takes around 10–15 minutes. When it finishes, EAS prints a download URL.

### 6. Share the APK with testers

Copy the download link from the terminal and send it to your testers. They will need to:

1. **Enable Unknown Sources** on their Android phone:
   - Go to *Settings → Security* (or *Settings → Apps → Special app access → Install unknown apps*)
   - Allow the browser (or file manager) to install apps from unknown sources

2. **Open the download link** in their phone's browser

3. **Tap the downloaded APK** to install it

The app installs like any Play Store app and appears in the app drawer as **IrrigBucket Mobile**.

## Build profiles

| Profile | Output | Use for |
|---|---|---|
| `preview` | APK | Sharing directly with testers |
| `production` | AAB (App Bundle) | Uploading to Google Play Store |
| `development` | APK with dev client | Active development with custom native code |

## Notes

- Builds run on Expo's cloud servers — you do not need Android Studio or a local Android SDK
- Each build is logged at [expo.dev/accounts/your-username/projects/irrigbucket-mobile](https://expo.dev)
- To bump the app version, increase `version` and `android.versionCode` in `app.json` before running the next build
- Always run build commands from the **monorepo root**, not from inside `artifacts/irrigbucket-mobile`
