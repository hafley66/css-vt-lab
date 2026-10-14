import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode, type RefObject } from "react";
import { flushSync } from "react-dom";

/* ------------------------------------------------------------------ */
/* Single-flight view-transition gate (React pattern: flushSync inside */
/* startViewTransition so the DOM mutation lands between snapshots).   */
/* Skips to direct mutation when unsupported, reduced-motion, or a     */
/* transition is already in flight.                                    */
/* ------------------------------------------------------------------ */

export function useViewTransitionGate() {
  const active = useRef(false);
  return useCallback((update: () => void) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reduce || active.current) {
      update();
      return;
    }
    active.current = true;
    const t = document.startViewTransition(() => flushSync(update));
    const done = () => { active.current = false; };
    t.finished.finally(done).catch(done);   // finished rejects on skip
  }, []);
}

const GateCtx = createContext<(update: () => void) => void>(() => {});

/** One shared flight per app: a grid transition and a chips transition
 *  never supersede each other. */
export function VTProvider({ children }: { children: ReactNode }) {
  const gate = useViewTransitionGate();
  return <GateCtx.Provider value={gate}>{children}</GateCtx.Provider>;
}

export const useVT = () => useContext(GateCtx);

/* ------------------------------------------------------------------ */
/* Layout-agnostic line counting: distinct line-box tops. Works for    */
/* flex, grid, inline-block — anything that wraps into fixed-height    */
/* lines.                                                              */
/* ------------------------------------------------------------------ */

export function lineCount(el: Element | null | undefined): number {
  if (!el) return 0;
  return new Set(Array.from(el.children, (c) => (c as HTMLElement).offsetTop)).size;
}

/* ------------------------------------------------------------------ */
/* Freeze-and-release container resize. ResizeObserver fires AFTER     */
/* reflow, so the old layout is gone; the container is frozen at the   */
/* pre-resize width immediately (flushSync), and the new width is      */
/* released INSIDE the VT callback, between the two snapshots.         */
/* ------------------------------------------------------------------ */

export function useFreezeRelease(
  ref: RefObject<HTMLElement | null>,
  apply: (width: number | null) => void,
) {
  const gate = useVT();
  const applyRef = useRef(apply);
  applyRef.current = apply;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let last: number | null = null;
    let timer: number | undefined;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w === last) return;
      if (last === null) { last = w; return; }        // initial observation: adopt, no lock
      flushSync(() => applyRef.current(last));        // freeze: restore pre-resize width now
      const target = w;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        gate(() => applyRef.current(target));         // release: new width lands between snapshots
        last = target;
      }, 60);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(timer);
    };
  }, [ref, gate]);
}
