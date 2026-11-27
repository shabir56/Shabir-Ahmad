// Validation of a contribution BEFORE it is sent. A copy of core/ContributionValidator.kt of the Android app.
// It never changes the text: the original is sent exactly as typed.

export const MAX_LENGTH = 10000;

export const Result = Object.freeze({
  OK: 'OK',
  EMPTY: 'EMPTY',
  TOO_LONG: 'TOO_LONG',
  NOT_PASHTO_SCRIPT: 'NOT_PASHTO_SCRIPT',
});

const LETTER = /\p{L}/u;

function isArabicScript(code) {
  return (code >= 0x0600 && code <= 0x06ff) ||
    (code >= 0x0750 && code <= 0x077f) ||
    (code >= 0xfb50 && code <= 0xfdff) ||
    (code >= 0xfe70 && code <= 0xfeff);
}

export function isBlank(text) {
  return /^[\s\u001c-\u001f]*$/.test(text);
}

export function validate(text) {
  if (isBlank(text)) return Result.EMPTY;
  if (text.length > MAX_LENGTH) return Result.TOO_LONG;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (isArabicScript(c.charCodeAt(0)) && LETTER.test(c)) return Result.OK;
  }
  return Result.NOT_PASHTO_SCRIPT;
}
