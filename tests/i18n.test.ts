import { describe, expect, it } from 'vitest';
import { STRINGS } from '../src/i18n/strings';
import { FONT_CHARS } from '../src/art/font';

describe('i18n', () => {
  it('has every key in both languages', () => {
    expect(Object.keys(STRINGS.en).sort()).toEqual(Object.keys(STRINGS.fr).sort());
  });

  it('only uses characters the bitmap font can draw', () => {
    const missing = new Set<string>();
    for (const table of Object.values(STRINGS)) {
      for (const s of Object.values(table)) for (const ch of s.toUpperCase()) if (!FONT_CHARS.includes(ch)) missing.add(ch);
    }
    expect([...missing]).toEqual([]);
  });
});
