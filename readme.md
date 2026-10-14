# css-vt-lab

Labs for the View Transitions API: same-document item morphs, wrap/re-wrap
detection in flex and grid, and how far the wrap logic can be pushed out of JS
into modern CSS. Each file is self-contained — open it directly in a browser.

## Files

| File | Demonstrates | Browser |
|---|---|---|
| `index.html` | minimal same-document VT: 2×2 grid, items 1/1↔2/2 swap via `document.startViewTransition` | any with VT |
| `wrap-lab.html` | wrap/re-wrap animation on a flex row; slider + resize streams; per-item morph groups; rows readout | any with VT (Chrome/Edge/Safari 18+/FF 139+) |
| `0_chromium-css.html` | the same lab with the math moved into CSS: `@function`, `if()`, typed `attr()`, `sibling-index()`, counters | Chromium ≥ 139 |
| `1_arbitrary-wrap.html` | arbitrary-width items: wrap detected relationally — "an element sits underneath the top-left child" — via a persistent phantom twin | any with VT |
| `mpa/a.html`, `mpa/b.html` | cross-document VT pair (`@view-transition { navigation: auto }`) | any with cross-doc VT |

## Running

Same-document labs work from `file://` (rxjs 7 loads as ESM from
`https://cdn.jsdelivr.net/npm/rxjs@7.8.1/+esm`, which sends `ACAO: *`).

The MPA pair needs a server — `file://` origins are opaque and cross-document
VT requires same-origin navigation:

```sh
cd mpa && python3 -m http.server 8000   # then visit a.html, click through
```

## Techniques

### Freeze-and-release (resize re-wraps are only animatable this way)

`ResizeObserver` fires *after* reflow — the old layout is unrecoverable by the
time you see the event. The row width is therefore kept locked at the last
committed size and only released *inside* the VT callback, between the old and
new snapshots:

```js
runWrap(() => root.style.setProperty('--locked-w', curW + 'px'));
```

### Boundary-gated, single-flight VTs

A VT per input event = invisible 1px diffs + every `startViewTransition`
skipping the one in flight. Instead: probe the candidate state, run a VT only
when wrap topology changes, and allow at most one live transition — crossings
while one is in flight mutate directly and the next boundary animates.

### The phantom twin (look-ahead without touching the live row)

Deciding "is this a boundary?" needs the candidate state *before* mutating
(old snapshot must still exist). A hidden clone answers it:

- `wrap-lab.html` builds it per event (uniform items could use arithmetic instead).
- `0_chromium-css.html` replaces it with closed-form capacity math in a CSS
  `@function` — uniform items make line count pure arithmetic.
- `1_arbitrary-wrap.html` keeps it **persistent** (built once, updated in
  place) because arbitrary widths have no closed form; the probe evaluates the
  relational predicate on the twin.

Phantom items must carry `view-transition-name: none !important` — the live
items' names are inline styles, and one duplicated name silently skips the
whole transition.

### Late callbacks read latest state, never closures

A VT update callback runs *after* the old snapshot is captured. Under load it
can execute after newer direct mutations — a closure-captured value then
clobbers them (observed: final `--iw` stuck at a stale value). Fix: commit
intent into a variable/attribute first (`curW`, `data-iw-next`), and callbacks
apply that, not their captured argument.

### Layout reads inside the VT callback see the old state

Rendering is suppressed between the snapshots; `offsetTop` reads inside the
update callback return pre-mutation layout. All readouts re-derive on
`transition.finished` (with `.catch` — `finished` rejects on skip), or
synchronously when no VT ran.

## View-transition facts accumulated

- `document.startViewTransition` still runs its callback when the document is
  hidden (the transition is skipped, the end state still lands).
- `transition.finished` **rejects** on skip/supersede — always attach `.catch`.
- Duplicated `view-transition-name` anywhere in the document skips the
  transition, regardless of visibility.
- `::view-transition-group(root) { animation-duration: 0.001s }` freezes the
  page-wide crossfade so only named items morph.

## Chromium-CSS findings (0_chromium-css.html, Chrome for Testing 150)

| Feature | Status in build |
|---|---|
| `@function` | works; result evaluated only in typed contexts |
| `floor()` / `ceil()` | not shipped — use `round(down, x, 1)` / `round(up, x, 1)` |
| same-type division (`1190px / 130px`) | resolves |
| `if(style(--x: v): …; else: …)` | works; conditions test custom-property state |
| typed `attr(data-iw px, 120px)` | works; one attribute write drives `--iw` |
| `sibling-index()` | works in any math context |
| unregistered custom props | computed value = token echo; register `@property` to read resolved numbers |

Visual line index (which flex/grid row an item landed on) has **no CSS
primitive** — `sibling-index()` is DOM order, containers read only their own
size, `anchor()` is barred from custom properties. For *uniform* items the
capacity formula is equivalent and fully CSS-expressible:

```css
--row: calc(round(down, (sibling-index() - 1) / var(--per-row-n, 1), 1) + 1);
```

For arbitrary widths `1_arbitrary-wrap.html` falls back to the relational
geometry predicate (and grid auto-flow satisfies the same predicate).

## Verification highlights

| Lab | Check | Result |
|---|---|---|
| wrap-lab | 1px burst, gating on | VTs = boundary crossings only; readout correct via `finished` |
| 0_chromium-css | burst 120→61 | final `--iw: 61px`, per-row/rows/labels all CSS-derived, `vtStarts: 1` |
| 1_arbitrary-wrap | phantom isolation | 14 phantom names `none`, 14 live names kept, single VT start under burst |
