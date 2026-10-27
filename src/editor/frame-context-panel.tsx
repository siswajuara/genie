import { useMemo, useState } from "react";
import {
  buildFrameContext,
  contextCoverage,
} from "../../sidecar/frame-context.mjs";
import type { CanvasDocument } from "./model";
export function FrameContextPanel({
  document,
  selection = [],
}: {
  document: CanvasDocument;
  selection?: string[];
}) {
  const [open, setOpen] = useState(false);
  const context = useMemo(
    () => buildFrameContext(document, selection),
    [document, selection.join(",")],
  );
  const coverage = useMemo(() => contextCoverage(context), [context]);
  return (
    <details
      className="frame-context-panel"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        AI frame context · {coverage.frames} frame · {coverage.layers} layer
      </summary>
      <p className="science-hint">
        Teks terlihat, persamaan, hasil hitung diagram, caption, dan narasi
        ikut dikirim sebagai konteks.
      </p>
      {coverage.audioNeedingTranscript.length > 0 && (
        <p className="science-hint">
          Audio tanpa transkrip:{" "}
          {coverage.audioNeedingTranscript.map((a) => a.name).join(", ")}. AI
          hanya membaca nama dan pengaturannya.
        </p>
      )}
      {coverage.characters > 120000 && (
        <p role="alert" className="error">
          Konteks terlalu besar; pilih lebih sedikit frame sebelum memakai AI.
        </p>
      )}
      {open && (
        <textarea
          aria-label="Full AI frame context"
          readOnly
          rows={7}
          value={JSON.stringify(context, null, 2)}
          style={{ width: "100%", fontSize: 11 }}
        />
      )}
    </details>
  );
}
