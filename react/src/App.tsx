import { ChipList } from "./ChipList";
import { GridPane } from "./GridPane";
import { VTProvider } from "./vt";

export default function App() {
  return (
    <VTProvider>
      <main>
        <h1>dynamic collapse — view transitions in react</h1>
        <p className="hint">
          one shared single-flight gate: every state change below either mutates
          directly (sub-threshold, reduced-motion, unsupported) or runs inside a
          view transition between snapshots.
        </p>
        <ChipList />
        <GridPane />
      </main>
    </VTProvider>
  );
}
