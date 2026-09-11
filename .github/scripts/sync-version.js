import fs from 'node:fs';
import path from 'node:path';

/**
 * Normalizes any user-provided version string into a valid SemVer string (X.Y.Z[-prerelease][+build]).
 * Handles cases like 'v1.0.0', 'V1.0', '1.0', '1', 'v2.0.0-beta.1', etc.
 */
function toSemver(val) {
  if (!val || typeof val !== 'string') return null;
  const clean = val.trim().replace(/^v/i, '').trim();
  if (!clean) return null;

  const match = clean.match(
    /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([a-zA-Z0-9.\-_]+))?(?:\+([a-zA-Z0-9.\-_]+))?$/
  );
  if (!match) return null;

  const major = parseInt(match[1], 10);
  const minor = match[2] !== undefined ? parseInt(match[2], 10) : 0;
  const patch = match[3] !== undefined ? parseInt(match[3], 10) : 0;
  const prerelease = match[4] ? `-${match[4]}` : '';
  const build = match[5] ? `+${match[5]}` : '';

  return `${major}.${minor}.${patch}${prerelease}${build}`;
}

/**
 * Strict SemVer specification regex (as required by Rust semver crate & Tauri).
 */
const STRICT_SEMVER_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

function readCurrentVersion() {
  // 1. Try package.json
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const parsed = toSemver(pkg.version);
    if (parsed && parsed !== '0.0.0') return parsed;
  } catch {}

  // 2. Try src-tauri/tauri.conf.json
  try {
    const tauri = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
    const parsed = toSemver(tauri.version);
    if (parsed && parsed !== '0.0.0') return parsed;
  } catch {}

  // 3. Try src-tauri/Cargo.toml
  try {
    const cargo = fs.readFileSync('src-tauri/Cargo.toml', 'utf8');
    const match = cargo.match(/version\s*=\s*"([^"]+)"/);
    if (match) {
      const parsed = toSemver(match[1]);
      if (parsed && parsed !== '0.0.0') return parsed;
    }
  } catch {}

  return '1.0.0';
}

function determineTargetVersion() {
  let rawInput = (process.env.INPUT_VERSION || '').trim();
  if (!rawInput && process.env.GITHUB_REF && process.env.GITHUB_REF.startsWith('refs/tags/')) {
    rawInput = (process.env.GITHUB_REF_NAME || '').trim();
  }
  const bumpType = (process.env.INPUT_BUMP_TYPE || 'none').toLowerCase().trim();
  const current = readCurrentVersion();

  console.log(`[Version Sync] Current detected version: ${current}`);

  let target = toSemver(rawInput);

  if (target) {
    console.log(`[Version Sync] Using normalized user input: ${target}`);
  } else if (bumpType && bumpType !== 'none') {
    const baseCore = current.split(/[-+]/)[0];
    const parts = baseCore.split('.').map((num) => parseInt(num, 10));
    let [major = 1, minor = 0, patch = 0] = parts;

    if (bumpType === 'major') {
      major += 1;
      minor = 0;
      patch = 0;
    } else if (bumpType === 'minor') {
      minor += 1;
      patch = 0;
    } else if (bumpType === 'patch') {
      patch += 1;
    }

    target = `${major}.${minor}.${patch}`;
    console.log(`[Version Sync] Bumped (${bumpType}) from ${current} -> ${target}`);
  } else {
    target = current;
    console.log(`[Version Sync] Keeping current version: ${target}`);
  }

  // Ensure strict SemVer compliance
  if (!STRICT_SEMVER_REGEX.test(target)) {
    console.warn(`[Version Sync] Target '${target}' did not pass strict SemVer regex. Fallback to 1.0.0`);
    target = '1.0.0';
  }

  return target;
}

/**
 * Converts any SemVer string into a valid Windows MSI numeric version (major.minor.patch[.build]).
 * WiX & Windows Installer ProductVersion constraints:
 * - major: 0 to 255
 * - minor: 0 to 255
 * - patch: 0 to 65535
 * - build: 0 to 65535 (optional)
 * - Strictly numeric-only (no letters, hyphens, or plus signs allowed).
 */
function toMsiVersion(val) {
  if (!val || typeof val !== 'string') return '1.0.0';
  const clean = val.trim().replace(/^v/i, '').trim();
  const match = clean.match(
    /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([a-zA-Z0-9.\-_]+))?(?:\+([a-zA-Z0-9.\-_]+))?$/
  );
  if (!match) return '1.0.0';

  const major = Math.min(parseInt(match[1], 10) || 0, 255);
  const minor = Math.min(parseInt(match[2] !== undefined ? match[2] : '0', 10) || 0, 255);
  const patch = Math.min(parseInt(match[3] !== undefined ? match[3] : '0', 10) || 0, 65535);

  let build = null;
  const tag = match[4] || match[5];
  if (tag) {
    const numMatch = tag.match(/\d+/);
    if (numMatch) {
      const parsedNum = parseInt(numMatch[0], 10);
      if (parsedNum <= 65535) {
        build = parsedNum;
      }
    }
  }

  return build !== null ? `${major}.${minor}.${patch}.${build}` : `${major}.${minor}.${patch}`;
}

function syncVersions() {
  const version = determineTargetVersion();
  const msiVersion = toMsiVersion(version);
  console.log(`[Version Sync] Target SemVer confirmed: ${version}`);
  console.log(`[Version Sync] WiX/MSI numeric version computed: ${msiVersion}`);

  // 1. Update package.json
  const pkgPath = path.resolve('package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.version = version;
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    console.log(`[Version Sync] Updated package.json -> ${version}`);
  }

  // 2. Update src-tauri/tauri.conf.json
  const tauriPath = path.resolve('src-tauri/tauri.conf.json');
  if (fs.existsSync(tauriPath)) {
    const tauri = JSON.parse(fs.readFileSync(tauriPath, 'utf8'));
    tauri.version = version;
    if (!tauri.bundle) tauri.bundle = {};
    if (!tauri.bundle.windows) tauri.bundle.windows = {};
    if (!tauri.bundle.windows.wix) tauri.bundle.windows.wix = {};
    tauri.bundle.windows.wix.version = msiVersion;
    fs.writeFileSync(tauriPath, `${JSON.stringify(tauri, null, 2)}\n`, 'utf8');
    console.log(`[Version Sync] Updated src-tauri/tauri.conf.json -> app: ${version}, wix: ${msiVersion}`);
  }

  // 3. Update src-tauri/Cargo.toml
  const cargoPath = path.resolve('src-tauri/Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    let cargo = fs.readFileSync(cargoPath, 'utf8');
    // Replace version under [package]
    cargo = cargo.replace(/(\[package\][\s\S]*?version\s*=\s*)"[^"]+"/, `$1"${version}"`);
    fs.writeFileSync(cargoPath, cargo, 'utf8');
    console.log(`[Version Sync] Updated src-tauri/Cargo.toml -> ${version}`);
  }

  // 4. Update src/constants/app.ts if it exists
  const appTsPath = path.resolve('src/constants/app.ts');
  if (fs.existsSync(appTsPath)) {
    let appTs = fs.readFileSync(appTsPath, 'utf8');
    appTs = appTs.replace(/export const APP_VERSION\s*=\s*'[^']+';/, `export const APP_VERSION = '${version}';`);
    fs.writeFileSync(appTsPath, appTs, 'utf8');
    console.log(`[Version Sync] Updated src/constants/app.ts -> ${version}`);
  }

  // 5. Output to GITHUB_OUTPUT if running in GitHub Actions
  const githubOutput = process.env.GITHUB_OUTPUT;
  if (githubOutput) {
    fs.appendFileSync(
      githubOutput,
      `version=${version}\ntag=v${version}\nmsi_version=${msiVersion}\n`,
      'utf8'
    );
    console.log(`[Version Sync] Exported to GITHUB_OUTPUT: version=${version}, tag=v${version}, msi_version=${msiVersion}`);
  }
}

syncVersions();
