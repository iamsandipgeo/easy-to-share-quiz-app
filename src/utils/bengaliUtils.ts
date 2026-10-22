/**
 * Bengali and English numerals and option marker mappings
 */

export const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
export const ENGLISH_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export const BENGALI_OPTION_LETTERS = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ'];
export const ENGLISH_OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

/**
 * Convert Bengali numerals string to standard English digit string
 */
export function bengaliToEnglishDigits(str: string): string {
  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(BENGALI_DIGITS[i], 'g'), ENGLISH_DIGITS[i]);
  }
  return result;
}

/**
 * Convert standard English digits to Bengali numerals
 */
export function englishToBengaliDigits(num: number | string): string {
  const str = String(num);
  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(ENGLISH_DIGITS[i], 'g'), BENGALI_DIGITS[i]);
  }
  return result;
}

/**
 * Check if text contains Bengali Unicode characters
 */
export function hasBengaliCharacters(text: string): boolean {
  // Bengali Unicode range: 0980 - 09FF
  return /[\u0980-\u09FF]/.test(text);
}

/**
 * Map an option identifier string (A, B, C, D, ক, খ, গ, ঘ, 1, 2, ৩) to a zero-based option index
 */
export function parseOptionIdentifierToIndex(token: string): number {
  const clean = token.trim().toUpperCase();
  if (!clean) return -1;

  // 1. English letters A-J
  const engIdx = ENGLISH_OPTION_LETTERS.indexOf(clean);
  if (engIdx !== -1) return engIdx;

  // 2. Bengali letters
  const benIdx = BENGALI_OPTION_LETTERS.indexOf(token.trim());
  if (benIdx !== -1) return benIdx;

  // 3. Digits (1-based: 1 -> index 0, 2 -> index 1)
  const normalizedDigitStr = bengaliToEnglishDigits(clean);
  const parsedNum = parseInt(normalizedDigitStr, 10);
  if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 10) {
    return parsedNum - 1;
  }

  return -1;
}

/**
 * Given a zero-based index, get human readable option label
 */
export function getOptionLabel(index: number, useBengali = false): string {
  if (useBengali && index < BENGALI_OPTION_LETTERS.length) {
    return BENGALI_OPTION_LETTERS[index];
  }
  if (index < ENGLISH_OPTION_LETTERS.length) {
    return ENGLISH_OPTION_LETTERS[index];
  }
  return String(index + 1);
}
