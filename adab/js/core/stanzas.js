// One tappa / kakṛai ghaṛai as the reader sees it: a block of lines inside a stored entry. A copy of core/Stanzas.kt
// of the Android app: keep both the same.
//
// An administrator may save several stanzas in ONE entry, separated by an empty line. A line counts as empty when it
// holds nothing but spaces, a carriage return or invisible direction / joiner marks (texts typed on a phone often have
// a lone space or a lone CR on the "empty" line).

const LINE_BREAKS = /\r\n|\r|\n|\u2028|\u2029/;
const WHITESPACE = /\s/;

function isInvisible(c) {
  const code = c.charCodeAt(0);
  return WHITESPACE.test(c) ||
    (code >= 0x1c && code <= 0x1f) ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069) ||
    code === 0x061c || code === 0xfeff;
}

function trimInvisible(s) {
  let start = 0;
  let end = s.length;
  while (start < end && isInvisible(s[start])) start++;
  while (end > start && isInvisible(s[end - 1])) end--;
  return s.slice(start, end);
}

/** The stanzas of a body, in order. Lines are trimmed at both ends; a blank body gives no stanza. */
export function split(body) {
  const result = [];
  let current = [];
  const flush = () => {
    if (current.length > 0) {
      result.push(current.join('\n'));
      current = [];
    }
  };
  for (const raw of body.split(LINE_BREAKS)) {
    const line = trimInvisible(raw);
    if (line.length === 0) flush();
    else current.push(line);
  }
  flush();
  return result;
}

export function count(body) {
  return split(body).length;
}

/** The text that stores the stanzas: one empty line between two stanzas. */
export function join(stanzas) {
  return stanzas.join('\n\n');
}

/**
 * Every stanza of the entries, keeping the order of the entries and, inside an entry, the order of the text.
 * An entry is {id, version, letter, body, isDeleted}.
 */
export function of(entries) {
  const result = [];
  for (const entry of entries) {
    if (entry.isDeleted) continue;
    split(entry.body).forEach((text, index) => {
      result.push({
        entryId: entry.id,
        entryVersion: entry.version,
        letter: entry.letter,
        index,
        text,
        key: `${entry.id}#${index}`,
      });
    });
  }
  return result;
}
