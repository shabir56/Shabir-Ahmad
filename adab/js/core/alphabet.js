// The Pashto alphabet used for browsing, in literary order. A copy of core/PashtoAlphabet.kt of the Android app:
// keep both the same. The letter of every entry is stored on the server as plain text, so this list only decides the
// order of the chips; the administrator picks the letter of an entry (in the Android app).
//
// Owner's decisions (2026-11-11): only ي stands for the whole yeh family (ی ې ۍ ئ are no letters of the alphabet);
// heh is WRITTEN ہ on screen but stays ه in the stored data.

export const LETTERS = [
  'ا', 'ب', 'پ', 'ت', 'ټ', 'ث', 'ج', 'چ', 'څ', 'ځ', 'ح', 'خ', 'د', 'ډ', 'ذ',
  'ر', 'ړ', 'ز', 'ژ', 'ږ', 'س', 'ش', 'ښ', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف',
  'ق', 'ک', 'ګ', 'ل', 'م', 'ن', 'ڼ', 'و', 'ه', 'ي',
];

const LETTER_SET = new Set(LETTERS);

const YEH_FORMS = new Set(['ی', 'ې', 'ۍ', 'ئ', 'ى', 'ے', 'ۓ', 'ێ']);
const HEH_FORMS = new Set(['ہ', 'ھ', 'ە', 'ۀ', 'ة']);

/** The alphabet letter a stored letter belongs to: every yeh form is ي, every heh form is ه. Other text unchanged. */
export function canonical(letter) {
  if (YEH_FORMS.has(letter)) return 'ي';
  if (HEH_FORMS.has(letter)) return 'ه';
  return letter;
}

/** How a letter is written on screen: heh as ہ, every other letter as it is. */
export function display(letter) {
  return letter === 'ه' ? 'ہ' : letter;
}

function normalizeChar(c) {
  let mapped = c;
  if (c === 'آ' || c === 'أ' || c === 'إ' || c === 'ٱ') mapped = 'ا';
  else if (c === 'ك' || c === 'ڪ') mapped = 'ک';
  else if (c === 'گ') mapped = 'ګ';
  const s = canonical(mapped);
  return LETTER_SET.has(s) ? s : null;
}

/** The first Pashto letter of a text (skipping spaces, quotes, digits, marks); the first letter when there is none. */
export function suggestLetter(text) {
  for (let i = 0; i < text.length; i++) {
    const n = normalizeChar(text[i]);
    if (n !== null) return n;
  }
  return LETTERS[0];
}

/** The place of a letter in the alphabet; a letter that is not in it goes last. */
export function position(letter) {
  const i = LETTERS.indexOf(letter);
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
}
