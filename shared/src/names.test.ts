import { describe, expect, it } from 'vitest';
import { nameKey, normalizeName, parseNameList, shortenName } from './names';

describe('shortenName', () => {
  it('keeps a name that fits', () => {
    expect(shortenName('Have dogs', 30)).toBe('Have dogs');
    expect(shortenName('x'.repeat(30), 30)).toBe('x'.repeat(30));
  });

  it('cuts a longer name to the limit and ends it with an ellipsis', () => {
    const result = shortenName('Visited a very remote and unusually beautiful place', 30);
    expect(result).toBe('Visited a very remote and unu…');
    expect(result.length).toBeLessThanOrEqual(30);
    expect(shortenName('x'.repeat(31), 30)).toBe(`${'x'.repeat(29)}…`);
  });

  it('does not leave a space before the ellipsis', () => {
    expect(shortenName('aaaa bbbb cccc', 10)).toBe('aaaa bbbb…');
    expect(shortenName('aaaaaaaaa bbbb', 10)).toBe('aaaaaaaaa…');
  });

  it('never cuts an emoji in half', () => {
    const name = `${'🎾'.repeat(20)}`; // 40 UTF-16 units
    const result = shortenName(name, 11);
    expect(result).toBe(`${'🎾'.repeat(5)}…`);
    expect(result.length).toBeLessThanOrEqual(11);
    // A family emoji is one character made of several parts: it stays whole or goes completely.
    const family = '👨‍👩‍👧‍👦';
    const mixed = shortenName(`abc ${family} ${family} ${family}`, 14);
    expect(mixed.length).toBeLessThanOrEqual(14);
    expect(mixed.endsWith('…')).toBe(true);
    expect(mixed.replace(/…$/, '')).not.toMatch(/‍$/);
  });
});

describe('normalizeName', () => {
  it('trims, collapses spaces and ignores case', () => {
    expect(normalizeName('  Anna   KOVAL ')).toBe('anna koval');
  });

  it('works for Ukrainian names', () => {
    expect(normalizeName('Гліб  Фіногенов')).toBe('гліб фіногенов');
  });
});

describe('nameKey', () => {
  it('is identical for names that differ only in case or spacing', () => {
    expect(nameKey('Anna Koval')).toBe(nameKey('  anna   koval'));
  });

  it('differs for different names', () => {
    expect(nameKey('Anna Koval')).not.toBe(nameKey('Anna Kovalenko'));
  });

  it('only uses characters that are legal in Table Storage keys', () => {
    expect(nameKey('Zoë ??? / # \\ Ж')).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('parseNameList', () => {
  it('shortens names that are too long when asked to, and counts them', () => {
    const long = 'A topic that is much longer than the limit allows';
    const result = parseNameList(`Short\n${long}\n${long}\n`, [], { shortenTo: 20 });
    expect(result.names).toEqual(['Short', 'A topic that is muc…']);
    expect(result.shortened).toBe(2);
    expect(result.duplicatesSkipped).toBe(1); // the second long line shortens to the same name
    expect(parseNameList(long).names).toEqual([long]); // not shortened unless asked
  });

  it('reads one name per line and ignores blank lines', () => {
    const result = parseNameList('Anna Koval\n\n  Ivan Petrenko  \r\nOlena Shevchenko\n');
    expect(result.names).toEqual(['Anna Koval', 'Ivan Petrenko', 'Olena Shevchenko']);
    expect(result.duplicatesSkipped).toBe(0);
  });

  it('skips duplicates inside the file without adding them twice', () => {
    const result = parseNameList('Anna Koval\nanna koval\nAnna   Koval\nIvan Petrenko');
    expect(result.names).toEqual(['Anna Koval', 'Ivan Petrenko']);
    expect(result.duplicatesSkipped).toBe(2);
  });

  it('skips names that already exist in the game', () => {
    const result = parseNameList('Anna Koval\nIvan Petrenko', ['ANNA KOVAL']);
    expect(result.names).toEqual(['Ivan Petrenko']);
    expect(result.duplicatesSkipped).toBe(1);
  });

  it('returns nothing for an empty file', () => {
    expect(parseNameList('')).toEqual({ names: [], duplicatesSkipped: 0, shortened: 0 });
  });
});
