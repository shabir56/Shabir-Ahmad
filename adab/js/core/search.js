// Loose text matching for the search box. A copy of core/SearchText.kt of the Android app: keep both the same.
//
// People type Pashto with different keyboards, so the same word is often spelled with different code points and with
// or without vowel marks. Both the typed text and the stored text are reduced to one common form before they are
// compared. Only the comparison is loose: the stored text is never changed. A search matches a text when EVERY typed
// word occurs somewhere in it, so the list only narrows while the user keeps typing.
//
// Indices are UTF-16 code units (like Kotlin's Char), so highlight spans can be cut straight out of the text.

const LETTER_OR_DIGIT = /[\p{L}\p{Nd}]/u;

const FOLD = new Map();
for (const c of 'يىیېۍێئےۓ') FOLD.set(c, 'ی');
for (const c of 'كڪ') FOLD.set(c, 'ک');
FOLD.set('گ', 'ګ');
for (const c of 'ەہھۀةۃ') FOLD.set(c, 'ه');
for (const c of 'آأإٱ') FOLD.set(c, 'ا');
FOLD.set('ؤ', 'و');
FOLD.set('ٹ', 'ټ');
FOLD.set('ڈ', 'ډ');
FOLD.set('ڑ', 'ړ');
FOLD.set('ڕ', 'ړ');
FOLD.set('ڻ', 'ڼ');
FOLD.set('ں', 'ن');
FOLD.set('ݜ', 'ښ');

/** One character in comparing form: one spelling per letter family; everything that is not a letter is a space. */
function fold(c) {
  const mapped = FOLD.get(c);
  if (mapped !== undefined) return mapped;
  const code = c.charCodeAt(0);
  if (code >= 0x0660 && code <= 0x0669) return String.fromCharCode(48 + code - 0x0660);
  if (code >= 0x06f0 && code <= 0x06f9) return String.fromCharCode(48 + code - 0x06f0);
  if (LETTER_OR_DIGIT.test(c)) {
    const lower = c.toLowerCase();
    return lower.length === 1 ? lower : c;
  }
  return ' ';
}

function isIgnorable(code) {
  return code === 0x0640 || // tatweel
    (code >= 0x064b && code <= 0x065f) || // Arabic vowel marks
    code === 0x0670 || // superscript alef
    (code >= 0x06d6 && code <= 0x06dc) || (code >= 0x06df && code <= 0x06e4) || code === 0x06e7 || code === 0x06e8 ||
    (code >= 0x06ea && code <= 0x06ed) || // Quranic marks
    code === 0x00ad || // soft hyphen
    (code >= 0x200b && code <= 0x200f) || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069) ||
    code === 0x061c || code === 0xfeff;
}

/** A text in comparing form, and for every kept character where it stood in the original. */
export function normalizeIndexed(text) {
  let out = '';
  const origin = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (isIgnorable(c.charCodeAt(0))) continue;
    out += fold(c);
    origin.push(i);
  }
  return { text: out, origin };
}

/** Reduces a text to the form used for comparing. */
export function normalize(text) {
  return normalizeIndexed(text).text;
}

/** The words of a query in comparing form (empty when the query is blank). */
export function words(query) {
  return normalize(query).split(' ').filter((w) => w.length > 0);
}

/** True when every word occurs in a text that is already in comparing form. */
export function matchesNormalized(normalizedText, queryWords) {
  if (queryWords.length === 0) return false;
  return queryWords.every((w) => normalizedText.includes(w));
}

/** True when every word of the query occurs in the text. */
export function matches(text, queryWords) {
  if (queryWords.length === 0) return false;
  return matchesNormalized(normalize(text), queryWords);
}

const INSIDE = 1000;

/**
 * How early the typed words stand in a text (comparing form), to put the best matches first. Lower is better: 0 means
 * the text begins with the typed word. A word that only holds the typed letters in its middle counts INSIDE more.
 * Sort stably, so equal ranks keep their old order.
 */
export function rankNormalized(normalizedText, queryWords) {
  if (queryWords.length === 0) return 0;
  const tokens = normalizedText.split(' ').filter((t) => t.length > 0);
  let total = 0;
  for (const word of queryWords) {
    const begins = tokens.findIndex((t) => t.startsWith(word));
    if (begins >= 0) {
      total += begins;
    } else {
      const inside = tokens.findIndex((t) => t.includes(word));
      total += inside >= 0 ? INSIDE + inside : INSIDE * 2;
    }
  }
  return total;
}

export function rank(text, queryWords) {
  return rankNormalized(normalize(text), queryWords);
}

/** The items whose text matches the query; a blank query matches nothing. Keeps the order of the items. */
export function filter(items, query, textOf) {
  const queryWords = words(query);
  if (queryWords.length === 0) return [];
  return items.filter((it) => matches(textOf(it), queryWords));
}

/**
 * Where the words of the query occur, as stretches {start, end} of the ORIGINAL text, sorted and merged (touching or
 * overlapping stretches become one).
 */
export function highlight(text, queryWords) {
  if (queryWords.length === 0 || text.length === 0) return [];
  const n = normalizeIndexed(text);
  const found = [];
  for (const word of queryWords) {
    if (word.length === 0) continue;
    let from = 0;
    for (;;) {
      const at = n.text.indexOf(word, from);
      if (at < 0) break;
      found.push({ start: n.origin[at], end: n.origin[at + word.length - 1] + 1 });
      from = at + word.length;
    }
  }
  if (found.length === 0) return [];
  found.sort((a, b) => a.start - b.start);
  const merged = [];
  let current = found[0];
  for (let i = 1; i < found.length; i++) {
    const next = found[i];
    if (next.start <= current.end) {
      current = { start: current.start, end: Math.max(current.end, next.end) };
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);
  return merged;
}
