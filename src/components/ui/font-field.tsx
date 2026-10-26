import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { lazy, Suspense, useRef, useState } from "react";
import "react-fontpicker-ts/dist/index.css";
import { ensureFont } from "../../lib/fonts";
import { PickerPopover } from "./popover";
import { Icon } from "./icon";
const GoogleFontPicker = lazy(() => import("react-fontpicker-ts"));
export function FontField({
  value,
  weight,
  onChange,
  onError,
}: {
  value: string;
  weight: number;
  onChange: (font: string) => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState("");
  const request = useRef(0);
  async function choose(family: string) {
    if (family === value) return;
    const id = ++request.current;
    setBusy(family);
    try {
      await ensureFont(family, weight);
      if (id === request.current) {
        onChange(family);
        setOpen(false);
      }
    } catch (err) {
      if (id === request.current) onError(String(err));
    } finally {
      if (id === request.current) setBusy("");
    }
  }
  return (
    <PickerPopover
      label="Google Fonts"
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button type="button" className="select-trigger" aria-label="Font">
          <span style={{ fontFamily: JSON.stringify(value) }}>{value}</span>
          <Icon name="down" size={15} />
        </Button>
      }
    >
      <div className="font-picker-panel">
        <Label htmlFor="google-font-search">Search Google Fonts</Label>
        <Suspense fallback={<p role="status">Loading font catalogue…</p>}>
          <GoogleFontPicker
            defaultValue={value}
            autoLoad={false}
            inputId="google-font-search"
            value={(family) => void choose(family)}
          />
        </Suspense>
        <p className="hint" role="status">
          {busy
            ? `Loading ${busy}…`
            : "Search by name. Fonts load before being applied."}
        </p>
        <div className="font-local-options">
          {[
            "Nunito",
            "Baloo 2",
            "Arial",
            "Georgia",
            "Courier New",
            "Impact",
            "Trebuchet MS",
          ].map((font) => (
            <Button
              key={font}
              type="button"
              style={{ fontFamily: JSON.stringify(font) }}
              onClick={() => void choose(font)}
            >
              {font}
            </Button>
          ))}
        </div>
      </div>
    </PickerPopover>
  );
}
