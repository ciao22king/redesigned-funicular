/**
 * Scanning of uploaded material for malware and harmful content.
 *
 * We are not an antivirus and we do not pretend to be: there is no signature
 * database here. What this does is the part that actually applies to a service
 * that only ever reads text:
 *   - a file that is not really text (a renamed binary, an executable, an
 *     archive) is refused by its magic bytes, so nothing that is not text gets
 *     read or forwarded;
 *   - the hostile shell and script patterns that a document can carry as plain
 *     text are flagged, because those are what would be handed to the model and
 *     to the reader;
 *   - the prompt-injection markers that try to escape the data block are
 *     flagged, and neutralized separately in `guardrails.wrapUntrusted`.
 *
 * The result is a verdict: `block` stops the request, `warn` lets it through
 * but tells the user what was found, `ok` is clean.
 */

export type ScanLevel = 'ok' | 'warn' | 'block';

export interface ScanFinding {
  level: ScanLevel;
  /** Short machine-readable label, for tests and for grouping. */
  kind: string;
  /** One sentence shown to the user, in English like the rest of the UI. */
  message: string;
}

export interface ScanResult {
  level: ScanLevel;
  findings: ScanFinding[];
}

/**
 * Magic bytes of the formats that must never be treated as text. A binary
 * renamed to `.md` is caught here, before anything reads it.
 */
const BINARY_SIGNATURES: { label: string; bytes: number[] }[] = [
  { label: 'ELF executable', bytes: [0x7f, 0x45, 0x4c, 0x46] },
  { label: 'Windows executable', bytes: [0x4d, 0x5a] },
  { label: 'PDF document', bytes: [0x25, 0x50, 0x44, 0x46] },
  { label: 'ZIP archive', bytes: [0x50, 0x4b, 0x03, 0x04] },
  { label: 'GZIP archive', bytes: [0x1f, 0x8b] },
  { label: 'PNG image', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { label: 'JPEG image', bytes: [0xff, 0xd8, 0xff] },
  { label: 'GIF image', bytes: [0x47, 0x49, 0x46, 0x38] },
  { label: 'Mach-O binary', bytes: [0xfe, 0xed, 0xfa, 0xce] },
  { label: 'Java class', bytes: [0xca, 0xfe, 0xba, 0xbe] },
];

/** Returns the label of the first binary signature matched, or null. */
export function detectBinary(head: Uint8Array): string | null {
  for (const sig of BINARY_SIGNATURES) {
    if (sig.bytes.length > head.length) continue;
    if (sig.bytes.every((b, i) => head[i] === b)) return sig.label;
  }
  return null;
}

/** The PDF magic bytes, which are allowed only for a file named `.pdf`. */
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46];

/** True when the bytes start with `%PDF-`. */
export function isPdfBytes(head: Uint8Array): boolean {
  return PDF_SIGNATURE.every((b, i) => head[i] === b);
}

/**
 * Harmful shell and script patterns. These are `block`: a document that carries
 * a fork bomb or a disk wipe is not material to document, it is a payload.
 */
const BLOCK_PATTERNS: { kind: string; re: RegExp; message: string }[] = [
  {
    kind: 'fork-bomb',
    re: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
    message: 'The material contains a shell fork bomb.',
  },
  {
    kind: 'disk-wipe',
    re: /\brm\s+-[a-z]*[rf][a-z]*\s+(\/(\s|$|\*)|--no-preserve-root)/i,
    message: 'The material contains a destructive disk command.',
  },
  {
    kind: 'disk-wipe',
    re: /\bmkfs(\.\w+)?\s+\/dev\//i,
    message: 'The material contains a filesystem formatting command.',
  },
  {
    kind: 'disk-wipe',
    re: /\bdd\s+[^\n]*of=\/dev\/[sh]d[a-z]/i,
    message: 'The material contains a raw disk write command.',
  },
  {
    kind: 'pipe-to-shell',
    re: /\b(curl|wget)\b[^\n|]{0,200}\|\s*(sudo\s+)?(ba|z|k|d)?sh\b/i,
    message: 'The material pipes a download straight into a shell.',
  },
  {
    kind: 'reverse-shell',
    re: /(bash\s+-i\s+>&\s*\/dev\/tcp\/|nc\s+-e\s+\/bin\/(ba)?sh|\/dev\/tcp\/\d{1,5})/i,
    message: 'The material contains a reverse-shell pattern.',
  },
  {
    kind: 'encoded-payload',
    re: /(powershell|pwsh)[^\n]{0,80}-(enc|encodedcommand)\b/i,
    message: 'The material contains an encoded PowerShell payload.',
  },
  {
    kind: 'credential-harvest',
    re: /(cat|type)\s+[^\n]{0,60}(\/etc\/shadow|\.aws\/credentials|id_rsa)/i,
    message: 'The material reads credential files.',
  },
];

/**
 * Prompt-injection markers. These are `warn`, not `block`: the same phrases can
 * legitimately appear in a document *about* prompt injection, and the generator
 * already treats the material as data. The user is told they were found.
 */
const WARN_PATTERNS: { kind: string; re: RegExp; message: string }[] = [
  {
    kind: 'prompt-injection',
    re: /ignore\s+(all\s+)?(the\s+)?(previous|prior|above)\s+instructions/i,
    message: 'The material contains a phrase that tries to override the instructions.',
  },
  {
    kind: 'prompt-injection',
    re: /\byou\s+are\s+now\b|\bnew\s+instructions?\s*:/i,
    message: 'The material tries to redefine the assistant.',
  },
  {
    kind: 'boundary-escape',
    re: /<\/?\s*source_material\b/i,
    message: 'The material tries to close the data block that wraps it.',
  },
  {
    kind: 'secret-exfiltration',
    re: /\b(reveal|print|repeat|show)\b[^\n]{0,40}\b(system\s+prompt|your\s+instructions|api\s*key)\b/i,
    message: 'The material asks to reveal the system prompt or a key.',
  },
];

/** Scans decoded text and returns a verdict with the findings. */
export function scanText(text: string): ScanResult {
  const findings: ScanFinding[] = [];

  for (const p of BLOCK_PATTERNS) {
    if (p.re.test(text)) findings.push({ level: 'block', kind: p.kind, message: p.message });
  }
  for (const p of WARN_PATTERNS) {
    if (p.re.test(text)) findings.push({ level: 'warn', kind: p.kind, message: p.message });
  }

  // Control characters other than tab, newline and carriage return: a text file
  // should not carry them, and they are a common way to smuggle data past a
  // reader that only looks at printable text.
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
    findings.push({
      level: 'warn',
      kind: 'control-characters',
      message: 'The material contains non-printable control characters.',
    });
  }

  return { level: worst(findings), findings };
}

/** Combines a text verdict with a binary check done on the raw bytes. */
export function scanUpload(name: string, bytes: Uint8Array): ScanResult {
  // A real PDF is expected to be binary: its text is extracted separately, not
  // decoded here. The extension check has already restricted it to `.pdf`, and
  // the magic bytes confirm it is a PDF rather than an executable renamed.
  const pdf = /\.pdf$/i.test(name);
  const binary = detectBinary(bytes);
  if (pdf) {
    if (isPdfBytes(bytes)) return { level: 'ok', findings: [] };
    return {
      level: 'block',
      findings: [
        {
          level: 'block',
          kind: 'binary',
          message: `${name} has a .pdf extension but is not a PDF file. Only real PDFs are accepted.`,
        },
      ],
    };
  }
  if (binary) {
    return {
      level: 'block',
      findings: [
        {
          level: 'block',
          kind: 'binary',
          message: `${name} is not a text file (${binary}). Only text is accepted.`,
        },
      ],
    };
  }
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const result = scanText(text);
  return { level: result.level, findings: result.findings };
}

/** Highest severity among the findings; `ok` when there are none. */
export function worst(findings: ScanFinding[]): ScanLevel {
  if (findings.some((f) => f.level === 'block')) return 'block';
  if (findings.some((f) => f.level === 'warn')) return 'warn';
  return 'ok';
}

/** Messages to show for a scan, at most one per kind, blocked ones first. */
export function scanMessages(result: ScanResult): string[] {
  const seen = new Set<string>();
  return result.findings
    .filter((f) => {
      if (seen.has(f.kind)) return false;
      seen.add(f.kind);
      return true;
    })
    .sort((a, b) => (a.level === 'block' ? -1 : b.level === 'block' ? 1 : 0))
    .map((f) => f.message);
}
