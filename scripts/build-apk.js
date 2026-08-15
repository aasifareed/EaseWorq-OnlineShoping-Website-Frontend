const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const flavor = (process.argv[2] || '').toLowerCase();
const flavors = {
  local: {
    ng: 'android',
    apkName: 'SastaKhareedo-local-debug.apk',
    api: 'dev tunnel (environment.android.ts)',
  },
  beta: {
    ng: 'android-beta',
    apkName: 'SastaKhareedo-beta-debug.apk',
    api: 'https://beta-onlineshopping-api.sastakhareedo.com/',
  },
  prod: {
    ng: 'android-prod',
    apkName: 'SastaKhareedo-prod-debug.apk',
    api: 'https://prod-onlineshopping-api.sastakhareedo.com/',
  },
};

if (!flavors[flavor]) {
  console.error('Usage: node scripts/build-apk.js <local|beta|prod>');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
const androidDir = path.join(root, 'android');
const apkOutDir = path.join(root, 'apk');
const builtApk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const isWin = process.platform === 'win32';
const config = flavors[flavor];

function run(command, args, cwd) {
  console.log(`\n> ${command} ${args.join(' ')}\n`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: isWin,
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`Building ${flavor.toUpperCase()} APK`);
console.log(`API: ${config.api}`);

run('npx', ['ng', 'build', `--configuration=${config.ng}`], root);
run('npx', ['cap', 'sync', 'android'], root);

const gradleCmd = isWin ? 'gradlew.bat' : './gradlew';
run(gradleCmd, ['assembleDebug'], androidDir);

if (!fs.existsSync(builtApk)) {
  console.error(`Gradle finished but APK was not found at:\n${builtApk}`);
  process.exit(1);
}

fs.mkdirSync(apkOutDir, { recursive: true });
const dest = path.join(apkOutDir, config.apkName);
fs.copyFileSync(builtApk, dest);

console.log('\nAPK ready:');
console.log(dest);
