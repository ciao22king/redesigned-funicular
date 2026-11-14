/**
 * Sanitising the fields that become public: a skill's name, description and
 * tags, and the author login.
 *
 * Two threats, two defences:
 *   - XSS: the React renderer already escapes text nodes, and the Markdown
 *     parser in `markdown.ts` returns a block model, never an HTML string, so
 *     there is no `dangerouslySetInnerHTML` on user input anywhere. This layer
 *     is the belt to that pair of braces: it removes angle brackets and
 *     control characters so no field can even look like markup.
 *   - Markup and layout abuse: a name full of `<>` or zero-width characters, or
 *     a description with embedded newlines that breaks a card, is normalised
 *     away.
 *
 * Everything is pure, so it is testable on its own.
 */

/** Removes control characters and collapses runs of whitespace to one space. */
export function collapseWhitespace(text: string): string {
  return text
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/[\u200b-\u200f\u2028\u2029\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Neutralises anything that looks like HTML or a script URL, then collapses
 * whitespace. The output is safe to place in a text node, an attribute value or
 * an RSS item: no `<`, no `>`, no `javascript:` scheme.
 */
export function sanitizePublicText(input: string): string {
  return collapseWhitespace(
    input
      .replace(/<[^>]*>/g, '')
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/data:text\/html/gi, ''),
  );
}

/** Sanitises and caps a public field. An empty result means "reject". */
export function sanitizeField(input: string | undefined, maxLength: number): string {
  return sanitizePublicText(input ?? '').slice(0, maxLength).trim();
}

/**
 * A login is already constrained by GitHub's own rules, but a published skill
 * carries it into URLs and pages, so it is normalised the same way. Anything
 * that is not `[A-Za-z0-9-]` is dropped.
 */
export function sanitizeLogin(login: string): string {
  return login.replace(/[^A-Za-z0-9-]/g, '').slice(0, 39);
}

/** True when the text carries something that was removed by sanitising. */
export function hasMarkup(input: string): boolean {
  return /[<>]/.test(input) || /javascript:/i.test(input) || /data:text\/html/i.test(input);
}
