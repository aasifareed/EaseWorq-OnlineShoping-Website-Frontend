# Sasta Khareedo — Android APK (Capacitor)

Same workflow as Fareed Mart POS: Angular build → `cap sync` → Android Studio / Gradle APK.

| | Website | POS |
|---|---|---|
| App ID | `com.fareedmart.onlineshop` | `com.fareedmart.pos` |
| App name | Sasta Khareedo | Fareed Mart POS |
| `webDir` | `dist/multikart/browser` | `dist` |
| Orientation | portrait | landscape |
| API env | `environment.android.ts` (local dev tunnel for now) | `environment-pos-android.ts` |

## Prerequisites

- Node 20.x (same as storefront `ng build`)
- JDK 17
- Android Studio (SDK 34+) with Android SDK Platform-Tools
- `ANDROID_HOME` / `local.properties` `sdk.dir` set

## Build & open

From `EaseWorq-OnlineShoping-Website-Frontend`:

```bash
npm install
npm run cap:sync
npm run cap:open
```

- `cap:sync` runs `ng build --configuration android` then copies assets into `android/`.
- `cap:copy` rebuilds and copies without updating native plugins.
- `cap:open` opens the project in Android Studio.

## Debug APK (Gradle)

```bash
npm run cap:sync
npm run cap:apk
```

APK output:

`android/app/build/outputs/apk/debug/app-debug.apk`

In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

Release / Play Store: create a signing keystore in Android Studio (**Build → Generate Signed Bundle / APK**) and use the `release` build type.

## Switch API

`environment.android.ts` `baseUrl` is the Host the APK calls.

| Build | `baseUrl` |
|---|---|
| Local (current) | `https://wqw3kv18-44374.uks1.devtunnels.ms/` (same as `environment.ts`) |
| Beta | `https://beta-onlineshopping-api.sastakhareedo.com/` (`environment.beta.ts`) |
| Prod | `https://prod-onlineshopping-api.sastakhareedo.com/` (`environment.prod.ts`) |

After changing `baseUrl`, run `npm run cap:sync` and rebuild the APK. Keep the Host / dev tunnel running while testing locally.

## CORS (Capacitor WebView)

`CapacitorHttp.enabled` is on so Angular `HttpClient` calls go through native Android HTTP and skip WebView CORS.

If you still see `blocked by CORS policy`, the config was not copied into the APK. Run `npx cap copy android` (or `npm run cap:sync`), uninstall the app on the phone, then rebuild/run.

Logcat lines like `NameNotFoundException: com.fareedmart.onlineshop` / `Error getting package info` during install are Oppo/GMS noise, not an app crash. Look for `Capacitor/Console` CORS or JS errors instead.

## GoPayFast / PayFast return

On web, PayFast redirects to the Host (`OnlineShopPayment/Success|Failure`), which then 302s to `/#/shop/checkout/success/{orderId}` (or failure) on the storefront.

On the APK, PayFast SUCCESS/FAILURE URLs point at a **local** page (`https://sastakhareedo.com/payfast-return.html`) inside the app — not the Dev Tunnel — so the Microsoft “Continue” screen is skipped. Angular then calls `CompleteMobileReturn` over native HTTP and opens the same success/failure screens.

Restart Host after pulling backend changes, then `npm run cap:sync` and rebuild the APK. Still configure **GoPayFastPaymentSuccess** / **GoPayFastPaymentFailed** in Admin → Status Events when you can.

## Images on the APK

Host returns media as `http://localhost:2222/...` or `https://localhost:44374/...`. The APK rewrites those to `baseUrl` **without keeping the local ports**, then loads them with CapacitorHttp (blob URLs). Keep Host + the dev tunnel running.

## Receipt download / preview (APK)

The website uses blob URLs (`<a download>` / `window.open`). The Android WebView cannot open those, so the APK saves the PDF with `@capacitor/filesystem` under `Documents/SastaKhareedo/` and opens the system share sheet (`@capacitor/share`) so the customer can save or open it in a PDF viewer.

## App icon / in-app logo

The APK uses the icon-only SK mark (no “Sasta Khareedo” text):

- Header + footer: `src/assets/images/logo-sk-mark.svg` when `environment.isMobileApp` is true
- Launcher + splash: `android/app/src/main/res/drawable/ic_launcher_foreground_sk.xml` on `#0A0A0A`

The website keeps the full uploaded store wordmark.

## Notes

- Tenant resolution uses `devHostName` / `isMobileApp` so the APK resolves the same storefront tenant as the website.
- Hardware back button pops Angular history; exits the app on the first page.
- Location permission is declared for checkout / working-area maps.
