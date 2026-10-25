/**
 * Normalizes a person or topic name so that "  Anna   KOVAL " and "anna koval" are the same.
 * Used everywhere a name must be unique within a game (case-insensitive, trimmed, single spaces).
 */
export function normalizeName(input: string): string {
  return input.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Table Storage row key for a name. Built from the normalized name, so two names that normalize to
 * the same text can never both be stored. Base64url output avoids the characters Table Storage
 * forbids in keys (\ / # ?).
 */
export function nameKey(input: string): string {
  const bytes = new TextEncoder().encode(normalizeName(input));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Cuts a name that is longer than `max` characters and ends it with "…", so the result is at most `max` characters long.
 * A character is never cut in half: an emoji (also one made of several parts, such as a family or a flag) stays whole or is removed.
 */
export function shortenName(name: string, max: number): string {
  if (name.length <= max) return name;
  const segments: Iterable<string> =
    typeof Intl !== 'undefined' && 'Segmenter' in Intl
      ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(name), (part) => part.segment)
      : Array.from(name);
  let result = '';
  for (const segment of segments) {
    if (result.length + segment.length > max - 1) break;
    result += segment;
  }
  return `${result.trimEnd()}…`;
}

export interface ParseOptions {
  /** Shorten names that are longer than this (see `shortenName`) instead of keeping them as they are. */
  shortenTo?: number;
}

export interface ParsedNames {
  /** Names to add, in file order, original capitalization kept, duplicates removed. */
  names: string[];
  /** Number of non-empty lines that were skipped because the name was already present. */
  duplicatesSkipped: number;
  /** Number of names that were cut to `shortenTo` characters. */
  shortened: number;
}

/**
 * Parses an uploaded .txt participant list (one name per line).
 * Blank lines are ignored; duplicates (inside the file or in `existing`) are silently skipped.
 */
export function parseNameList(text: string, existing: Iterable<string> = [], options: ParseOptions = {}): ParsedNames {
  const seen = new Set<string>();
  for (const name of existing) seen.add(nameKey(name));

  const names: string[] = [];
  let duplicatesSkipped = 0;
  let shortened = 0;
  for (const line of text.split(/\r\n|\r|\n/)) {
    let name = line.trim().replace(/\s+/g, ' ');
    if (!name) continue;
    if (options.shortenTo !== undefined && name.length > options.shortenTo) {
      name = shortenName(name, options.shortenTo);
      shortened += 1;
    }
    const key = nameKey(name);
    if (seen.has(key)) {
      duplicatesSkipped += 1;
      continue;
    }
    seen.add(key);
    names.push(name);
  }
  return { names, duplicatesSkipped, shortened };
}
