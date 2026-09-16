/**
 * Path Utilities for yt-dlp-client
 */

/**
 * Wraps a file or folder path in double quotes if not already enclosed,
 * preventing whitespace and argument separation issues when pasted into
 * shells (PowerShell, cmd.exe, bash), terminal commands, or file managers.
 */
export function formatQuotedPath(path?: string | null): string {
  if (!path) return '';
  const trimmed = path.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed : `"${trimmed}"`;
}
