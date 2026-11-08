/**
 * Explicit limits on uploaded files: how many, how big, and which formats.
 *
 * The browser `accept` attribute is a hint, not a control: it is easy to bypass
 * and does not apply to drag and drop. These rules are the real ones, and the
 * UI imports the same constants so the message it shows can never drift from
 * what the server enforces.
 *
 * Everything here is pure, so it is testable without a browser.
 */

/** Maximum number of files accepted in a single request. */
export const MAX_FILES = 20;
/** Maximum size of one file. */
export const MAX_FILE_BYTES = 256 * 1024;
/** Maximum combined size of all files, material and sources included. */
export const MAX_TOTAL_BYTES = 2 * 1024 * 1024;

/**
 * Extensions we accept, mapped to the MIME type they normally carry.
 *
 * The list is deliberately text-only: the generator reads text, and accepting
 * archives or binaries would only widen the attack surface.
 */
export const ALLOWED_EXTENSIONS = [
  '.md',
  '.markdown',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.csv',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.sh',
  '.sql',
  '.html',
  '.css',
  '.xml',
] as const;

const ALLOWED = new Set<string>(ALLOWED_EXTENSIONS);

/** The `accept` attribute for the file input, built from the same list. */
export const ACCEPT_ATTRIBUTE = ALLOWED_EXTENSIONS.join(',');

export interface FileCheck {
  ok: boolean;
  error?: string;
}

/** Extension of a file name, lower case, or an empty string. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot).toLowerCase();
}

/** True when the extension is on the allowlist. */
export function isAllowedExtension(name: string): boolean {
  return ALLOWED.has(extensionOf(name));
}

/**
 * Checks a single file before it is read.
 *
 * Size and extension are the two things we can decide from metadata alone. The
 * content itself is checked by `scanText` in `scans.ts`, once it is text.
 */
export function validateFile(file: { name: string; size: number }): FileCheck {
  if (!isAllowedExtension(file.name)) {
    const ext = extensionOf(file.name) || '(no extension)';
    return {
      ok: false,
      error: `${file.name}: ${ext} is not accepted. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}.`,
    };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: `${file.name} is ${formatBytes(file.size)}. The limit per file is ${formatBytes(MAX_FILE_BYTES)}.`,
    };
  }
  return { ok: true };
}

/** Checks the count and the combined size of a batch of files. */
export function validateFileBatch(files: { name: string; size: number }[]): FileCheck {
  if (files.length > MAX_FILES) {
    return { ok: false, error: `At most ${MAX_FILES} files per generation.` };
  }
  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_TOTAL_BYTES) {
    return {
      ok: false,
      error: `The files add up to ${formatBytes(total)}. The combined limit is ${formatBytes(MAX_TOTAL_BYTES)}.`,
    };
  }
  for (const file of files) {
    const check = validateFile(file);
    if (!check.ok) return check;
  }
  return { ok: true };
}

/** Human-readable size, so the error message does not talk in bytes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Label for the UI, built from the same constants the server enforces. */
export function uploadRulesLabel(): string {
  return `Up to ${MAX_FILES} files, ${formatBytes(MAX_FILE_BYTES)} each, ${formatBytes(
    MAX_TOTAL_BYTES,
  )} in total.`;
}
