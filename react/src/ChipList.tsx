import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { lineCount, useFreezeRelease, useVT } from "./vt";

const WORDS = ["wrap", "detect", "relational", "x", "underneath", "top-left", "android",
  "constraint", "flex", "grid", "arbitrary", "phantom", "twin", "below"];
const FACTORS = [0.6, 0.45, 0.8, 0.5, 0.7, 0.55, 0.9, 0.5, 0.65, 0.45, 0.75, 0.6, 0.85, 0.5];

type Display = "flex" | "inline-block" | "grid";

/** Arbitrary-width, fixed-height chip list. Re-wraps are animated with view
 *  transitions, gated on wrap topology: a hidden phantom twin evaluates the
 *  candidate chip size before the live row mutates, so the old snapshot is
 *  still available when a boundary crossing starts a transition. */
export function ChipList() {
  const [px, setPx] = useState(120);
  const [lockedW, setLockedW] = useState<number | null>(null);
  const [display, setDisplay] = useState<Display>("flex");
  const rowRef = useRef<HTMLDivElement>(null);
  const phantomRef = useRef<HTMLDivElement>(null);
  const gate = useVT();
  useFreezeRelease(rowRef, setLockedW);

  const items = useMemo(() => WORDS.map((w, i) => ({ w, f: FACTORS[i] })), []);

  const chips = items.map(({ w, f }, i) => (
    <span key={w} className="chip" style={{ width: `calc(var(--iw) * ${f})`, viewTransitionName: `chip-${i}` }}>
      {w}
    </span>
  ));

  const onSlider = (next: number) => {
    // look-ahead: candidate size on the phantom twin only (no live mutation,
    // so the VT can still capture the old state if this is a boundary)
    const ph = phantomRef.current;
    if (ph && rowRef.current) {
      // phantom must wrap in the same box as the live row — its width comes
      // from the live row, not from CSS (absolute positioning would resolve
      // 100% against the viewport and disagree at every wrap boundary)
      ph.style.width = rowRef.current.getBoundingClientRect().width + "px";
      ph.style.setProperty("--iw", next + "px");
      if (lineCount(ph) !== lineCount(rowRef.current)) {
        gate(() => setPx(next));
        return;
      }
    }
    setPx(next);   // sub-wrap delta: mutate directly
  };

  // phantom width tracks the live row after every render (slider probes set
  // it too, but the freeze-release resize path bypasses onSlider)
  useLayoutEffect(() => {
    const ph = phantomRef.current;
    const row = rowRef.current;
    if (ph && row) ph.style.width = row.getBoundingClientRect().width + "px";
  });

  return (
    <section>
      <h2>chips — arbitrary widths, fixed line height</h2>
      <p className="hint">
        drag the slider / resize the window / switch layout: re-wraps morph, sub-wrap
        nudges apply instantly. lines: layout-agnostic measurement.
      </p>
      <div className="controls">
        <label>
          chip size <output>{px}</output>px{" "}
          <input type="range" min={60} max={320} value={px}
            onChange={(e) => onSlider(+e.target.value)} />
        </label>
        <label>
          layout{" "}
          {/* capture the value NOW: gate defers the update into the VT
              callback, and React's controlled-restore rewinds the select to
              the current state before that callback reads e.target */}
          <select value={display}
            onChange={(e) => { const next = e.target.value as Display; gate(() => setDisplay(next)); }}>
            <option value="flex">flex</option>
            <option value="inline-block">inline-block</option>
            <option value="grid">grid</option>
          </select>
        </label>
      </div>
      <div
        ref={rowRef}
        className={`chiprow ${display}`}
        style={{ width: lockedW ?? "100%", ["--iw" as string]: `${px}px` }}
      >
        {chips}
      </div>
      {/* phantom twin: same children, hidden, out of flow. candidate --iw is
          applied here for measurement only. */}
      <div
        ref={phantomRef}
        aria-hidden
        className={`chiprow phantom ${display}`}
        style={{ ["--iw" as string]: `${px}px` }}
      >
        {chips}
      </div>
    </section>
  );
}
