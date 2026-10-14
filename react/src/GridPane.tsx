import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { DataGrid, type GridColDef, type GridFilterModel } from "@mui/x-data-grid";
import { useVT } from "./vt";

const HEIGHTS = [52, 40, 28] as const;   // comfortable → standard → compact

type Row = { id: number; name: string; team: string; region: string; load: number };

const ROWS: Row[] = Array.from({ length: 200 }, (_, i) => ({
  id: i,
  name: `service-${String(i).padStart(3, "0")}`,
  team: ["core", "edge", "ml", "infra"][i % 4],
  region: ["us-1", "eu-2", "ap-3", "sa-4"][i % 4],
  load: ((i * 37) % 100),
}));

const COLS: GridColDef<Row>[] = [
  { field: "name", headerName: "service", width: 180 },
  { field: "team", headerName: "team", width: 120 },
  { field: "region", headerName: "region", width: 120 },
  { field: "load", headerName: "load %", width: 100, type: "number" },
  { field: "id", headerName: "id", width: 80, type: "number" },
];

/** MUI DataGrid CE (virtualized, fixed row heights). "Collapse" = row-height
 *  density step + filter. Rows are recycled by the virtualizer, so
 *  view-transition-names are stamped post-render per stable row id; only
 *  mounted (visible) rows participate, which keeps names unique. */
export function GridPane() {
  const [level, setLevel] = useState(0);
  const [filtered, setFiltered] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const gate = useVT();

  const filterModel: GridFilterModel | undefined = useMemo(
    () => filtered
      ? { items: [{ field: "load", operator: ">", value: 40 }] }
      : undefined,
    [filtered],
  );

  // The virtualizer can recycle row elements asynchronously after a commit,
  // wiping inline names. So names are stamped twice: here after every render
  // (covers the NEW snapshot inside flushSync), and in the collapse/filter
  // handlers synchronously before gate() (covers the OLD snapshot).
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    for (const row of host.querySelectorAll<HTMLElement>(".MuiDataGrid-row")) {
      const id = row.getAttribute("data-id");
      if (id) row.style.viewTransitionName = `row-${id}`;
    }
  });

  const stampRowNames = () => {
    const host = hostRef.current;
    if (!host) return;
    for (const row of host.querySelectorAll<HTMLElement>(".MuiDataGrid-row")) {
      const id = row.getAttribute("data-id");
      if (id) row.style.viewTransitionName = `row-${id}`;
    }
  };
  const collapseRows = () => {
    stampRowNames();
    gate(() => setLevel((l) => (l + 1) % HEIGHTS.length));
  };
  const toggleFilter = () => {
    stampRowNames();
    gate(() => setFiltered((f) => !f));
  };

  const rowH = HEIGHTS[level];
  return (
    <section>
      <h2>mui datagrid CE — virtualized, fixed row height</h2>
      <p className="hint">
        collapse/expand cycles row height (52 → 40 → 28 → 52); filter drops rows.
        both morph: visible rows slide as a group, names keyed by row id, not index.
      </p>
      <div className="controls">
        <button onClick={collapseRows}>
          collapse / expand rows
        </button>
        <button onClick={toggleFilter}>
          {filtered ? "clear filter" : "filter load > 40"}
        </button>
        <span className="hint">row height: {rowH}px · rows: {filtered ? "118" : "200"}</span>
      </div>
      <div ref={hostRef} style={{ height: 420 }}>
        <DataGrid
          rows={ROWS}
          columns={COLS}
          filterModel={filterModel}
          hideFooterSelectedRowCount
          disableRowSelectionOnClick
        />
      </div>
    </section>
  );
}
