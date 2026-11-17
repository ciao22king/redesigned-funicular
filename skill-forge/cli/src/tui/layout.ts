/**
 * Geometry of the frame: where every line sits and which row a click lands on.
 *
 * The renderer and the mouse hit-test both read these functions, so what is
 * drawn and what is clickable can never drift apart: a click on the fifth line
 * opens the section that the fifth line shows, by construction.
 *
 * The chrome is one header line, one footer line, and (on the list) one line of
 * column titles.
 */

import type { Section } from './sections.js';
import { fit, visibleLength, wrap } from './text.js';
import { color } from '../output.js';

export const HEADER_LINES = 1;
export const FOOTER_LINES = 1;
export const COLUMN_LINES = 1;

/** A single drawn line of the detail pane. */
export interface DetailLine {
  text: string;
  /** Which section it belongs to, or -1 for a gap between sections. */
  sectionIndex: number;
  /** True for the `## Title` line, which is the click target of the section. */
  isTitle: boolean;
}

export function listViewportFor(height: number): number {
  return Math.max(1, height - HEADER_LINES - FOOTER_LINES - COLUMN_LINES);
}

export function detailViewportFor(height: number): number {
  return Math.max(1, height - HEADER_LINES - FOOTER_LINES);
}

/**
 * Expands the sections into the lines the pane will draw. A closed section is
 * one line (its title); an open one adds its wrapped body.
 */
export function detailLines(
  sections: Section[],
  expanded: Set<number>,
  width: number,
): DetailLine[] {
  const lines: DetailLine[] = [];
  sections.forEach((section, index) => {
    const marker = expanded.has(index) ? '▾' : '▸';
    const indent = section.level > 2 ? '  ' : '';
    lines.push({
      text: `${indent}${marker} ${color.bold(section.title)}`,
      sectionIndex: index,
      isTitle: true,
    });
    if (!expanded.has(index)) return;
    for (const raw of section.body.split('\n')) {
      const text = styleBodyLine(raw);
      const bodyWidth = Math.max(1, width - 2 - indent.length);
      const wrapped = wrap(text, bodyWidth);
      for (const line of wrapped) {
        lines.push({ text: `${indent}  ${line}`, sectionIndex: index, isTitle: false });
      }
    }
  });
  return lines;
}

/**
 * Light markdown styling: headings bold, fenced code dim, everything else as
 * written. The view is a reader, not a renderer, so it stays predictable.
 */
function styleBodyLine(line: string): string {
  if (/^\s*#{1,6}\s+/.test(line)) return color.bold(line);
  if (/^\s*```/.test(line)) return color.dim(line);
  return line;
}

/** Index of the row drawn at screen line `y`, or -1 when `y` is not a row. */
export function hitTestList(rowCount: number, height: number, y: number, offset: number): number {
  const top = HEADER_LINES + COLUMN_LINES;
  const index = y - top + offset;
  if (y < top || y >= height - FOOTER_LINES) return -1;
  return index >= 0 && index < rowCount ? index : -1;
}

/** Index of the section whose title is drawn at line `y`, or -1. */
export function hitTestDetail(
  lines: DetailLine[],
  height: number,
  y: number,
  offset: number,
): number {
  if (y < HEADER_LINES || y >= height - FOOTER_LINES) return -1;
  const line = lines[y - HEADER_LINES + offset];
  if (!line) return -1;
  return line.sectionIndex;
}

/** True when `y` is the header line, where the search box lives. */
export function hitTestHeader(y: number): boolean {
  return y < HEADER_LINES;
}

/** Left/right padding shared by header, rows and footer. */
export function padRow(text: string, width: number): string {
  return fit(` ${text} `, width);
}

export { visibleLength };
