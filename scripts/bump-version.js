import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkgPath = path.join(rootDir, 'package.json');
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');

// Read current package.json
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = pkg.version;

const input = process.argv[2];

if (!input) {
  console.log(`Current version: ${currentVersion}`);
  console.log(`\nUsage:\n  npm run bump <version>\n  npm run bump [patch | minor | major]`);
  console.log(`\nExamples:\n  npm run bump 1.3.0\n  npm run bump patch`);
  process.exit(0);
}

function parseSemver(ver) {
  const clean = ver.replace(/^v/, '');
  const parts = clean.split('.').map(n => parseInt(n, 10));
  if (parts.length !== 3 || parts.some(n => isNaN(n))) {
    return null;
  }
  return parts;
}

let newVersion = input.trim().replace(/^v/, '');

if (input === 'patch' || input === 'minor' || input === 'major') {
  const semver = parseSemver(currentVersion);
  if (!semver) {
    console.error(`Error: Cannot calculate ${input} bump from current version: "${currentVersion}"`);
    process.exit(1);
  }
  if (input === 'patch') semver[2] += 1;
  if (input === 'minor') { semver[1] += 1; semver[2] = 0; }
  if (input === 'major') { semver[0] += 1; semver[1] = 0; semver[2] = 0; }
  newVersion = semver.join('.');
} else {
  if (!parseSemver(newVersion)) {
    console.error(`Error: Invalid semver format "${newVersion}". Expected format like "1.3.0".`);
    process.exit(1);
  }
}

console.log(`Bumping version: ${currentVersion} -> ${newVersion}\n`);

// 1. Update package.json
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(`✓ Updated package.json: ${newVersion}`);

// 2. Update src-tauri/tauri.conf.json
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = newVersion;
  if (tauriConf.bundle?.windows?.wix) {
    tauriConf.bundle.windows.wix.version = newVersion.split('-')[0];
  }
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n', 'utf8');
  console.log(`✓ Updated src-tauri/tauri.conf.json: ${newVersion}`);
}

// 3. Update src-tauri/Cargo.toml
if (fs.existsSync(cargoTomlPath)) {
  let cargoContent = fs.readFileSync(cargoTomlPath, 'utf8');
  cargoContent = cargoContent.replace(/^version\s*=\s*"[^"]+"/m, `version = "${newVersion}"`);
  fs.writeFileSync(cargoTomlPath, cargoContent, 'utf8');
  console.log(`✓ Updated src-tauri/Cargo.toml: ${newVersion}`);
}

console.log(`\n🎉 Success! Project version bumped to ${newVersion}.`);
console.log(`Frontend src/constants/app.ts now automatically reflects v${newVersion}.`);
