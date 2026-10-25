# Accessibility

What was checked and what to keep in mind.

## Automated checks (run in CI on every change)

`web/src/a11y.test.tsx` runs [axe](https://github.com/dequelabs/axe-core) on every main screen: start page, name picker, player screen (also with the delete confirmation open), admin sign-in, game list, game page, Timer screen, all nine results views and the crash screen. These catch missing labels, wrong roles and landmarks, duplicate ids and similar problems. The suite found and fixed one issue (an alert role on the main landmark of the crash screen).

## Color contrast (measured with `node scripts/contrast.mjs`)

Axe cannot measure contrast in a simulated browser, so the real color pairs are measured against WCAG AA.

| Pair | Ratio | Needs |
|------|-------|-------|
| Body text on page | 17.1:1 | 4.5:1 |
| Muted text on page | 7.0:1 | 4.5:1 |
| Links on page | 10.7:1 | 4.5:1 |
| Button text on primary blue | 5.2:1 | 4.5:1 |
| Button text on danger red | 6.5:1 | 4.5:1 |
| Muted text on cards | 5.7:1 | 4.5:1 |
| Error / success / warning banners | 9.1 to 10.0:1 | 4.5:1 |
| Time-is-up clock, "everyone connected" text | 6.5 and 10.3:1 | 3:1 (large text) |
| Topic line colors on the background (12 colors) | 6.4 to 11.8:1 | 3:1 (graphics) |
| Focus outline, isolated-person ring | 11.7:1 | 3:1 |

All pairs pass. The script exits with an error if a pair ever fails, so it can be added to CI when colors change.

## Built in

- Visible keyboard focus (3 px yellow outline) on every control; everything is reachable with the keyboard.
- Touch targets of about 44 px on phones; native dropdowns (`select`) for choosing people and topics, which phones present in their own accessible picker.
- Every form control has a visible label; errors and notices use `role="alert"` / `role="status"`.
- The countdown is a `role="timer"` that is not announced every second.
- The graph and the matrix are exposed as images with a text description, and every statistic in the graph is also available as text in the other views (counters, leaderboard, group lists, spotlight lists).
- `prefers-reduced-motion` turns off line-drawing, pulsing and the smooth movement of dots.
- Sizes use `rem`, so browser text zoom scales the interface (not formally tested at 200 %).
- The page language is declared (`lang="en"`); all text is in one file (`web/src/strings.ts`) so translations can be added later.

## Known limitations

- In the network graph, the topic of a line is shown by **color only**. The legend and the "Top topics" and "Topic spotlight" views give the same information as text. Patterns or direct labels on lines could be added if needed.
- The big-screen views are designed for a projector or a large laptop, not for small phones (the player screens are the phone-first ones).
- Screen readers get the graph as one described image; the connections themselves are readable in the admin connection list and in the results views as text.
