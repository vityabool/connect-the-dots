#!/usr/bin/env node
/**
 * Prints the WCAG contrast ratio of the main text/background color pairs used by the app.
 * AA needs 4.5:1 for normal text and 3:1 for large text and graphics.
 */
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const BG = '#0f172a';
const pairs = [
  ['Body text on page', '#f8fafc', BG, 4.5],
  ['Muted text on page', '#94a3b8', BG, 4.5],
  ['Links on page', '#7dd3fc', BG, 4.5],
  ['Small delete/remove links', '#fca5a5', BG, 4.5],
  ['Button text on primary blue', '#ffffff', '#2563eb', 4.5],
  ['Button text on secondary grey', '#ffffff', '#334155', 4.5],
  ['Button text on danger red', '#ffffff', '#b91c1c', 4.5],
  ['Text on card', '#f8fafc', '#1e293b', 4.5],
  ['Muted text on card', '#94a3b8', '#1e293b', 4.5],
  ['Error banner text', '#ffffff', '#7f1d1d', 4.5],
  ['Success banner text', '#ffffff', '#14532d', 4.5],
  ['Warning banner text', '#ffffff', '#78350f', 4.5],
  ['Time is up (large clock)', '#f87171', BG, 3],
  ['Everyone connected (large text)', '#4ade80', BG, 3],
  ['Isolated-person ring (graphic)', '#facc15', BG, 3],
  ['Focus outline (graphic)', '#facc15', BG, 3],
  ['Graph dot on background (graphic)', '#f8fafc', BG, 3],
];
for (const color of ['#38bdf8', '#f472b6', '#facc15', '#4ade80', '#fb923c', '#a78bfa', '#2dd4bf', '#f87171', '#60a5fa', '#e879f9', '#a3e635', '#fbbf24']) {
  pairs.push([`Topic line ${color}`, color, BG, 3]);
}

// Public pages (landing page, how to play, legal pages).
pairs.push(
  ['Landing: lead text on page', '#cbd5e1', BG, 4.5],
  ['Landing: lead text on cards', '#cbd5e1', '#111c33', 4.5],
  ['Landing: body text in articles on page', '#dbe4f0', BG, 4.5],
  ['Landing: links on cards', '#7dd3fc', '#111c33', 4.5],
  ['Landing: eyebrow labels', '#38bdf8', BG, 4.5],
  ['Landing: gradient text start', '#38bdf8', BG, 4.5],
  ['Landing: gradient text end', '#a78bfa', BG, 4.5],
  ['Landing: footer text', '#94a3b8', '#080d1c', 4.5],
  ['Landing: footer links', '#cbd5e1', '#080d1c', 4.5],
  ['Landing: table header on header row', '#ffffff', '#17233f', 4.5],
  ['Landing: round time badge', '#7dd3fc', '#12253f', 4.5],
  ['Landing: "to be completed" marker', '#1c1917', '#facc15', 4.5],
  ['Landing: primary button text', '#ffffff', '#2563eb', 4.5],
  ['Landing: primary button hover', '#ffffff', '#1d4ed8', 4.5],
  ['Landing: notice text on warning box', '#fef3c7', '#2b2a2b', 4.5],
  ['Landing: skip link', '#1c1917', '#facc15', 4.5],
);

let failed = 0;
for (const [label, fg, bg, min] of pairs) {
  const value = ratio(fg, bg);
  const ok = value >= min;
  if (!ok) failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${value.toFixed(2).padStart(5)}:1  (needs ${min}:1)  ${label}`);
}
if (failed) process.exitCode = 1;
