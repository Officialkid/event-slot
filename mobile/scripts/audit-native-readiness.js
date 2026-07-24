const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const checks = [];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function addCheck(name, passed, detail) {
  checks.push({ name, passed, detail });
}

function requireValue(name, actual, expected) {
  addCheck(name, actual === expected, `expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
}

function requireTruthy(name, value, detail) {
  addCheck(name, Boolean(value), detail);
}

function requireFile(relativePath) {
  addCheck(`Asset exists: ${relativePath}`, fs.existsSync(path.join(root, relativePath)), "required for native build/store presentation");
}

const packageJson = readJson("package.json");
const appJson = readJson("app.json");
const easJson = readJson("eas.json");
const expo = appJson.expo;

requireValue("Expo SDK stays pinned to SDK 53", packageJson.dependencies.expo, "^53.0.0");
requireValue("React version matches Expo SDK 53", packageJson.dependencies.react, "19.0.0");
requireValue("React Native version matches Expo SDK 53", packageJson.dependencies["react-native"], "0.79.5");
requireTruthy("SecureStore dependency is present", packageJson.dependencies["expo-secure-store"], "needed for native token storage");
requireTruthy("Camera dependency is present", packageJson.dependencies["expo-camera"], "needed for QR scanning");
requireTruthy("Document picker dependency is present", packageJson.dependencies["expo-document-picker"], "needed for file upload questions");
requireTruthy("Notifications dependency is present", packageJson.dependencies["expo-notifications"], "needed for native push preparation");

requireValue("Native app name is EventSlot", expo.name, "EventSlot");
requireValue("Native URL scheme is eventslot", expo.scheme, "eventslot");
requireValue("Native API points at production web API", expo.extra && expo.extra.apiBaseUrl, "https://www.eventsslot.com");
requireValue("Android package is separate from TWA", expo.android && expo.android.package, "com.alphatech.eventslot.native");
requireValue("iOS bundle is separate from web/TWA identity", expo.ios && expo.ios.bundleIdentifier, "com.alphatech.eventslot.native");

requireFile("assets/icon.png");
requireFile("assets/adaptive-icon.png");
requireFile("assets/splash.png");
requireFile("docs/play-data-safety.md");
requireFile("src/services/runtimeInfo.ts");
requireFile("src/domain/runtimeInfo.ts");

const androidPermissions = (expo.android && expo.android.permissions) || [];
addCheck("Android does not request RECORD_AUDIO", !androidPermissions.includes("RECORD_AUDIO"), "QR scanning must not request microphone/audio");
addCheck("Android notifications permission is explicit", androidPermissions.includes("POST_NOTIFICATIONS"), "Android 13+ push prompts need POST_NOTIFICATIONS");

const cameraPlugin = expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-camera");
requireTruthy("Expo camera plugin is configured", cameraPlugin, "camera permission copy and audio guard should be explicit");
if (cameraPlugin) {
  requireValue("Camera audio recording stays disabled", cameraPlugin[1] && cameraPlugin[1].recordAudioAndroid, false);
}

const buildProfiles = easJson.build || {};
for (const [profileName, profile] of Object.entries(buildProfiles)) {
  requireValue(`EAS ${profileName} build remains internal`, profile.distribution, "internal");
}

addCheck("No EAS submit profile exists", !easJson.submit, "native app must not be uploaded automatically before approval");
requireValue("Production native auth uses live mode", buildProfiles.production && buildProfiles.production.env && buildProfiles.production.env.EXPO_PUBLIC_EVENTSSLOT_AUTH_MODE, "live");
requireValue("Production native uploads remain gated", buildProfiles.production && buildProfiles.production.env && buildProfiles.production.env.EXPO_PUBLIC_EVENTSSLOT_UPLOADS_ENABLED, "false");
requireValue("Production native push backend remains gated", buildProfiles.production && buildProfiles.production.env && buildProfiles.production.env.EXPO_PUBLIC_EVENTSSLOT_PUSH_ENABLED, "false");

const failedChecks = checks.filter((check) => !check.passed);

for (const check of checks) {
  const prefix = check.passed ? "PASS" : "FAIL";
  console.log(`${prefix} ${check.name} - ${check.detail}`);
}

if (failedChecks.length > 0) {
  console.error(`\nNative readiness audit failed: ${failedChecks.length} check(s) need attention.`);
  process.exit(1);
}

console.log(`\nNative readiness audit passed: ${checks.length} checks.`);
