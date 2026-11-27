// The rules (no drawing) of the picture card made when a reader shares ONE tappa / kakṛai ghaṛai: the owner's design
// "B" (dark green ground, gold frame, the rabab faint behind the verse). A copy of core/ShareCardLayout.kt of the
// Android app; the drawing is in js/ui/share.js.

import { split } from './stanzas.js';

export const WIDTH = 1080;
export const HEIGHT = 1350;
export const MAX_FONT = 64;
export const MIN_FONT = 22;
export const LINE_FACTOR = 2;
export const TEXT_WIDTH = 860;
export const VERSE_MAX_HEIGHT = 815;

/** The lines of a stanza as they are drawn: trimmed, with no empty line. */
export function lines(text) {
  return split(text).flatMap((s) => s.split('\n'));
}

/** The genre name written above the verse; empty for an unknown genre. */
export function genreLabel(slug) {
  if (slug === 'tapa') return 'ټپه';
  if (slug === 'kakari') return 'کاکړۍ غاړه';
  return '';
}

/**
 * The font size of the verse. widestAtMax is the width of the widest line drawn at MAX_FONT. Keeps the widest line
 * inside TEXT_WIDTH and all lines inside VERSE_MAX_HEIGHT; between MIN_FONT and MAX_FONT.
 */
export function fontSize(widestAtMax, lineCount) {
  const byWidth = widestAtMax <= 0 ? MAX_FONT : (MAX_FONT * TEXT_WIDTH) / widestAtMax;
  const byHeight = lineCount <= 0 ? MAX_FONT : VERSE_MAX_HEIGHT / (lineCount * LINE_FACTOR);
  return Math.max(MIN_FONT, Math.min(MAX_FONT, byWidth, byHeight));
}
