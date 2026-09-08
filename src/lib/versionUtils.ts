/**
 * Compares two semantic version strings (e.g., '1.0.0', 'v1.0.1', '2026.08.19').
 * Returns:
 *   > 0 if v1 > v2
 *   < 0 if v1 < v2
 *   0 if v1 === v2
 */
export function compareSemver(v1: string, v2: string): number {
  const clean = (v: string) => (v || '').replace(/^v/i, '').trim();
  const c1 = clean(v1);
  const c2 = clean(v2);

  if (!c1 && !c2) return 0;
  if (!c1) return -1;
  if (!c2) return 1;

  // Split into base version and metadata
  const parts1 = c1.split(/[-+]/)[0].split('.').map(n => parseInt(n, 10) || 0);
  const parts2 = c2.split(/[-+]/)[0].split('.').map(n => parseInt(n, 10) || 0);
  const maxLen = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] ?? 0;
    const num2 = parts2[i] ?? 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  return 0;
}

/**
 * Returns true if latest version is strictly greater than current version.
 */
export function isNewerVersion(latest: string, current: string): boolean {
  return compareSemver(latest, current) > 0;
}

/**
 * Formats a byte number to readable string (e.g. 42.1 MB).
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Formats an ISO date string into a friendly localized date (e.g. 'Sep 7, 2026').
 */
export function formatReleaseDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}
