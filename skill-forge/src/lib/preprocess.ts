/**
 * Deterministic pre-processing of source material.
 *
 * The model is good at writing the skill and bad at some mechanical jobs that
 * are better done exactly: turning an SRT/VTT transcript into prose, stripping
 * the timestamp noise, and collapsing a pile of messy notes into clean lines.
 * Doing it here means the model spends its budget on the procedure, not on
 * repeating a cue number.
 *
 * Everything is pure and idempotent, so it can run on paste, on upload, and
 * again on the server, without changing the result the second time.
 */

/** `00:00:12,340` (SRT) or `00:00:12.340` (VTT), optionally with an end time. */
const CUE_TIME_RE = /^\s*\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}\s*-->/;

/** A bare SRT cue index line: an integer alone on a line. */
const CUE_INDEX_RE = /^\s*\d+\s*$/;

/** True when the text looks like a subtitle/transcript file. */
export function looksLikeTranscript(text: string): boolean {
  const head = text.slice(0, 4000);
  if (/^\s*WEBVTT\b/i.test(head)) return true;
  return head.split('\n').some((l) => CUE_TIME_RE.test(l));
}

/**
 * Converts an SRT or WebVTT transcript into plain prose.
 *
 * Speaker turns are preserved as paragraphs and consecutive cues from the same
 * speaker are merged, which is what makes a meeting transcript readable as
 * material instead of as a subtitle file.
 */
export function transcriptToText(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const cues: string[] = [];
  let buffer: string[] = [];

  const flush = () => {
    const joined = buffer.join(' ').replace(/\s+/g, ' ').trim();
    if (joined) cues.push(joined);
    buffer = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (/^WEBVTT\b/i.test(line)) continue;
    if (CUE_TIME_RE.test(line)) {
      flush();
      continue;
    }
    if (CUE_INDEX_RE.test(line)) continue; // cue number
    // "Speaker: text" or "SPEAKER: text" is a natural paragraph break.
    const speaker = line.match(/^([A-Z][\w .'-]{0,40}):\s*(.*)$/);
    if (speaker && speaker[2]) {
      flush();
      cues.push(`${speaker[1]}: ${speaker[2]}`);
      continue;
    }
    buffer.push(line);
  }
  flush();

  // Merge consecutive cues from the same speaker.
  const merged: string[] = [];
  for (const cue of cues) {
    const last = merged[merged.length - 1];
    const sameSpeaker =
      last &&
      /^([A-Z][\w .'-]{0,40}):/.exec(cue)?.[1] === /^([A-Z][\w .'-]{0,40}):/.exec(last)?.[1];
    if (sameSpeaker) {
      merged[merged.length - 1] = `${last} ${cue.replace(/^[^:]+:\s*/, '')}`;
    } else {
      merged.push(cue);
    }
  }

  return merged.join('\n\n');
}

/** Lines that are pure decoration and carry no material. */
const NOISE_LINE_RE =
  /^\s*(?:[-=*_~]{3,}|[<>]{2,}|page\s+\d+(?:\s+of\s+\d+)?|\d+\s*\/\s*\d+|\|\s*\|.*?)\s*$/i;

/**
 * Normalises messy notes: strips a UTF-8 BOM, converts tabs to spaces, drops
 * decorative separator lines and page markers, collapses long runs of blank
 * lines to one, and trims trailing whitespace. It never rewrites the words,
 * only their framing.
 */
export function normalizeNotes(text: string): string {
  const withoutBom = text.replace(/^\uFEFF/, '').replace(/\u00a0/g, ' ');
  const lines = withoutBom.replace(/\r\n?/g, '\n').split('\n');
  const kept: string[] = [];
  let blank = false;

  for (const raw of lines) {
    const line = raw.replace(/\t+/g, '  ').replace(/\s+$/, '');
    if (!line.trim()) {
      if (!blank && kept.length) kept.push('');
      blank = true;
      continue;
    }
    if (NOISE_LINE_RE.test(line)) continue;
    blank = false;
    kept.push(line);
  }

  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export interface PreprocessResult {
  text: string;
  /** Which transformations actually ran, for the UI to explain what happened. */
  applied: string[];
}

/**
 * Runs the right transformations for the material's shape. A transcript is
 * converted first; the notes pass then cleans the result. Idempotent.
 */
export function preprocessMaterial(text: string): PreprocessResult {
  const applied: string[] = [];
  let out = text;

  if (looksLikeTranscript(out)) {
    const converted = transcriptToText(out);
    if (converted && converted !== out) {
      applied.push('converted the transcript to prose');
      out = converted;
    }
  }

  const cleaned = normalizeNotes(out);
  if (cleaned !== out) {
    applied.push('normalised the notes');
    out = cleaned;
  }

  return { text: out, applied };
}
