/**
 * Text extraction from PDF files, with no dependency.
 *
 * A real PDF parser is a large project; this is the part that matters for the
 * generator. It reads the content streams, inflates the FlateDecode ones with
 * the platform's own `DecompressionStream`, and pulls the text out of the
 * operators a technical document actually uses (`Tj`, `TJ`, `'`, `"`, plus the
 * line-positioning operators that mark a new line).
 *
 * What it does not do: OCR a scan, decode an exotic font CMap, or reconstruct
 * tables and columns. When the result is too thin, the caller says so instead of
 * feeding the model an almost-empty string.
 *
 * The whole module is pure and synchronous once the (async) inflate step is
 * done, so it is testable on a literal PDF built in the test.
 */

/** Cap on the inflated content, so a decompression bomb cannot exhaust memory. */
const MAX_INFLATED_BYTES = 4 * 1024 * 1024;
/** Cap on the extracted text. */
const MAX_TEXT_CHARS = 200_000;

/**
 * Decodes bytes to a string one byte per char (latin1). PDF syntax is ASCII,
 * and literals carry their own byte escapes, so this is enough and avoids any
 * dependency on Node's `Buffer` on the Worker runtime.
 */
function toLatin1(bytes: Uint8Array): string {
  let out = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return out;
}

export interface PdfText {
  ok: boolean;
  text: string;
  /** Number of content streams found and the number inflated. */
  streams: number;
  inflated: number;
  error?: string;
}

/** Decompresses a zlib (FlateDecode) buffer through the platform stream. */
async function inflate(data: Uint8Array): Promise<Uint8Array | null> {
  try {
    const ds = new DecompressionStream('deflate');
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(ds);
    const chunks: Uint8Array[] = [];
    let total = 0;
    // Read manually so we can enforce the cap mid-stream.
    const reader = stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_INFLATED_BYTES) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.byteLength;
    }
    return out;
  } catch {
    return null;
  }
}

/** Decodes a PDF literal string `(...)`, resolving the escapes. */
export function decodeLiteralString(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const next = raw[++i];
    switch (next) {
      case 'n': out += '\n'; break;
      case 'r': out += '\r'; break;
      case 't': out += '\t'; break;
      case 'b': out += '\b'; break;
      case 'f': out += '\f'; break;
      case '(': out += '('; break;
      case ')': out += ')'; break;
      case '\\': out += '\\'; break;
      case '\n': break; // line continuation
      case '\r': if (raw[i + 1] === '\n') i++; break;
      default:
        if (next >= '0' && next <= '7') {
          let oct = next;
          while (oct.length < 3 && raw[i + 1] >= '0' && raw[i + 1] <= '7') oct += raw[++i];
          out += String.fromCharCode(parseInt(oct, 8));
        } else {
          out += next ?? '';
        }
    }
  }
  return out;
}

/**
 * Extracts the visible text from a content stream, preserving line breaks.
 *
 * Text shown by `Tj`/`TJ` is concatenated; `Td`, `TD`, `T*` and `TL` start a new
 * line, which is what keeps a procedure from collapsing into one paragraph.
 */
export function extractTextFromContent(content: string): string {
  const lines: string[] = [];
  let current = '';

  // Tokenise on the operators we care about, keeping literal strings intact.
  const re = /(\((?:\\.|[^\\()])*\))\s*Tj|\[((?:[^\][]|\\.)*)\]\s*TJ|(T\*|Td|TD)|'(?=\s)|(ET|BT)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const flush = () => {
    const text = current.replace(/\s+/g, ' ').trim();
    if (text) lines.push(text);
    current = '';
  };

  // Fallback pass for the plain strings between operators, so a stream that uses
  // an operator we did not list still yields its text.
  const emitString = (s: string) => {
    current += decodeLiteralString(s);
  };

  while ((match = re.exec(content)) !== null) {
    // Pull any bare (...) strings in the gap before this operator.
    for (const s of content.slice(lastIndex, match.index).matchAll(/\((?:\\.|[^\\()])*\)/g)) {
      emitString(s[0].slice(1, -1));
    }
    lastIndex = re.lastIndex;

    if (match[1]) {
      emitString(match[1].slice(1, -1));
    } else if (match[2] !== undefined) {
      for (const s of match[2].matchAll(/\((?:\\.|[^\\()])*\)/g)) {
        emitString(s[0].slice(1, -1));
      }
    } else if (match[3]) {
      flush();
    } else if (match[4]) {
      flush();
    }
  }
  flush();

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Finds every `stream ... endstream` block with its preceding dictionary. */
function contentStreams(bytes: Uint8Array): { data: Uint8Array; flate: boolean }[] {
  const latin = toLatin1(bytes);
  const out: { data: Uint8Array; flate: boolean }[] = [];

  // `stream` also occurs inside `endstream`, so a bare match would pick up the
  // wrong block; the lookbehind requires the keyword to stand on its own.
  const re = /(?<![a-zA-Z])stream\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(latin)) !== null) {
    const start = match.index + match[0].length;
    const end = latin.indexOf('endstream', start);
    if (end === -1) break;
    // The dictionary is the text just before `stream`.
    const dictStart = Math.max(0, match.index - 200);
    const dict = latin.slice(dictStart, match.index);
    const flate = /\/FlateDecode/.test(dict);
    let slice = bytes.subarray(start, end);
    // Trim the single trailing EOL the spec allows before `endstream`.
    if (slice.length && slice[slice.length - 1] === 0x0a) slice = slice.subarray(0, -1);
    if (slice.length && slice[slice.length - 1] === 0x0d) slice = slice.subarray(0, -1);
    out.push({ data: slice, flate });
    re.lastIndex = end;
  }
  return out;
}

/**
 * Extracts text from a whole PDF file. Async because inflating is async.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<PdfText> {
  if (bytes.length < 5 || toLatin1(bytes.subarray(0, 5)) !== '%PDF-') {
    return { ok: false, text: '', streams: 0, inflated: 0, error: 'Not a PDF file.' };
  }

  const streams = contentStreams(bytes);
  const parts: string[] = [];
  let inflated = 0;

  for (const s of streams) {
    let text: string;
    if (s.flate) {
      const raw = await inflate(s.data);
      if (!raw) continue;
      inflated++;
      text = extractTextFromContent(toLatin1(raw));
    } else {
      text = extractTextFromContent(toLatin1(s.data));
    }
    if (text) parts.push(text);
    if (parts.join('\n').length > MAX_TEXT_CHARS) break;
  }

  const text = parts.join('\n\n').slice(0, MAX_TEXT_CHARS).trim();
  if (text.length < 40) {
    return {
      ok: false,
      text,
      streams: streams.length,
      inflated,
      error:
        'The PDF yielded almost no readable text. It may be a scan or use embedded fonts; export it as text or paste it instead.',
    };
  }
  return { ok: true, text, streams: streams.length, inflated };
}
