import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import type { AnimationPlayback } from "./use-animation-playback";
import { PickerPopover } from "../components/ui/popover";
import { SelectField } from "../components/ui/select";
import { Icon, type IconName } from "../components/ui/icon";

function TimelineButton({
  label,
  icon,
  onClick,
  active,
  disabled,
  primary,
}: {
  label: string;
  icon: IconName;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <Button
      type="button"
      className={primary ? "primary" : ""}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size={16} />
    </Button>
  );
}

/** Short m:ss.t form, e.g. 0:06.0 instead of "6.00 s 0f". */
function formatTimelineTime(value: number) {
  const clamped = Math.max(0, value);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped - minutes * 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
}

export type TimelineFilter = "all" | "selected" | "animated" | "text";
export function TimelineControls({
  playback: p,
  zoom,
  onZoom,
  onFit,
  search,
  onSearch,
  filter,
  onFilter,
}: {
  playback: AnimationPlayback;
  zoom: number;
  onZoom: (value: number) => void;
  onFit: () => void;
  search: string;
  onSearch: (value: string) => void;
  filter: TimelineFilter;
  onFilter: (value: TimelineFilter) => void;
}) {
  const zooms = [...new Set([0.5, 1, 2, 4, zoom])].sort((a, b) => a - b);
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <>
      <header className="timeline-toolbar">
        <div
          className="row timeline-transport"
          role="group"
          aria-label="Playback"
        >
          <TimelineButton
            label="Return to start"
            icon="previous"
            onClick={() => p.seek(p.range?.start ?? 0)}
          />
          <TimelineButton
            label="Previous video frame"
            icon="stepBack"
            onClick={() => p.seek(p.time - 1 / p.fps)}
          />
          <TimelineButton
            label={
              p.playing ? "Pause animation (Space)" : "Play animation (Space)"
            }
            icon={p.playing ? "pause" : "play"}
            onClick={p.toggle}
            primary
          />
          <TimelineButton
            label="Next video frame"
            icon="stepForward"
            onClick={() => p.seek(p.time + 1 / p.fps)}
          />
          <TimelineButton
            label="Go to end"
            icon="next"
            onClick={() => p.seek(p.range?.end ?? p.duration)}
          />
          <output
            aria-label="Playhead time"
            title={`${Math.round(p.time * p.fps)} frames at ${p.fps} fps`}
          >
            {formatTimelineTime(p.time)} / {formatTimelineTime(p.duration)}
          </output>
          <TimelineButton
            label="Loop preview"
            icon="repeat"
            active={p.loop}
            onClick={() => p.setLoop(!p.loop)}
          />
          <TimelineButton
            label="Snap to frames and nearby timing (hold Alt while dragging to disable)"
            icon="magnet"
            active={p.snapping}
            onClick={() => p.setSnapping(!p.snapping)}
          />
        </div>
        <div
          className="row timeline-tools"
          role="group"
          aria-label="Timeline view"
        >
          <div className="timeline-zoom-select">
            <SelectField
              label="Timeline zoom"
              value={String(zoom)}
              onChange={(value) => onZoom(Number(value))}
              options={zooms.map((value) => ({
                value: String(value),
                label: `${Math.round(value * 100)}%`,
              }))}
            />
          </div>
          <TimelineButton
            label="Fit timeline to width"
            icon="fit"
            onClick={onFit}
          />
          <PickerPopover
            label="Playback settings"
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            align="end"
            trigger={
              <Button
                type="button"
                title="Playback settings: speed, frame rate, motion"
                aria-label="Playback settings"
              >
                <Icon name="settings" size={16} />
              </Button>
            }
          >
            <div className="timeline-settings">
              <SelectField
                label="Playback speed"
                value={String(p.speed)}
                onChange={(value) => p.setSpeed(Number(value))}
                options={[0.25, 0.5, 1, 1.5, 2].map((value) => ({
                  value: String(value),
                  label: `${value}× speed`,
                }))}
              />
              <SelectField
                label="Timeline frame rate"
                value={String(p.fps)}
                onChange={(value) => p.setFps(Number(value))}
                options={[24, 30, 60].map((value) => ({
                  value: String(value),
                  label: `${value} fps`,
                }))}
              />
              <Label className="check">
                <Checkbox
                  checked={p.reducedMotion}
                  onCheckedChange={(checked) =>
                    p.setReducedMotion(checked === true)
                  }
                />
                Reduce animations in preview
              </Label>
            </div>
          </PickerPopover>
          <TimelineButton
            label="Hide timeline"
            icon="close"
            onClick={() => p.setOpen(false)}
          />
        </div>
      </header>
      <div className="timeline-editbar">
        <div className="timeline-search">
          <Icon name="search" size={14} />
          <Input
            aria-label="Search timeline layers"
            placeholder="Find a layer"
            value={search}
            onChange={(ev) => onSearch(ev.target.value)}
          />
        </div>
        <div className="timeline-filter">
          <SelectField
            label="Filter timeline layers"
            value={filter}
            onChange={(value) => onFilter(value as TimelineFilter)}
            options={[
              { value: "all", label: "All layers" },
              { value: "selected", label: "Selected layers" },
              { value: "animated", label: "Animated layers" },
              { value: "text", label: "Text layers" },
            ]}
          />
        </div>
        <Button
          className="timeline-edit-button"
          onClick={p.edit}
          disabled={!p.preview}
          title={
            p.preview
              ? "Leave preview and edit the canvas"
              : "Select a layer or press Play to preview, then edit"
          }
        >
          <Icon name="rename" size={14} />
          Edit canvas
        </Button>
      </div>
    </>
  );
}
