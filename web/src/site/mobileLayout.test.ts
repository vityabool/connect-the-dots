import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = (name: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', name), 'utf8');

// jsdom does no layout, so these guard the rules that stop wide content (the large game-code input) from stretching a
// grid column past a phone's screen. Without them the join card ran off the right edge on phones.
describe('mobile layout rules', () => {
  it('the hero grid column cannot grow with its content', () => {
    expect(css('site.css')).toMatch(/\.hero-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });

  it('the results graph never grows taller than the screen', () => {
    expect(css('results.css')).toMatch(/\.frame \.network\s*\{[^}]*max-height:\s*calc\(100vh/);
  });

  it('forms use shrinkable columns and inputs never exceed their column', () => {
    const styles = css('styles.css');
    expect(styles).toMatch(/\.form\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(styles).toMatch(/\.form input,\s*\.form textarea\s*\{[^}]*box-sizing:\s*border-box;[^}]*width:\s*100%;[^}]*min-width:\s*0/);
  });
});
