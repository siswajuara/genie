import type { AnimationPlayback } from "./useAnimationPlayback";
import { clamp } from "./animation";
import { SelectField } from "../components/ui/Controls";
import { Icon, type IconName } from "../components/ui/Icon";

export function TimelineButton({
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
    <button
      type="button"
      className={primary ? "primary" : ""}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size={16} />
    </button>
  );
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
  previousKey,
  nextKey,
  addKey,
  hasSelection,
}: {
  playback: AnimationPlayback;
  zoom: number;
  onZoom: (value: number) => void;
  onFit: () => void;
  search: string;
  onSearch: (value: string) => void;
  filter: TimelineFilter;
  onFilter: (value: TimelineFilter) => void;
  previousKey: () => void;
  nextKey: () => void;
  addKey: () => void;
  hasSelection: boolean;
}) {
  const zooms = [...new Set([0.5, 1, 2, 4, zoom])].sort((a, b) => a - b);
  return (
    <>
      <header className="timeline-toolbar">
        <div
          className="row timeline-transport"
          role="group"
          aria-label="Playback controls"
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
            label={p.playing ? "Pause animation" : "Play animation"}
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
          <output aria-label="Playhead time">
            {p.time.toFixed(2)} / {p.duration.toFixed(2)} s{" "}
            <span>{Math.round(p.time * p.fps)}f</span>
          </output>
          <TimelineButton
            label="Loop preview"
            icon="repeat"
            active={p.loop}
            onClick={() => p.setLoop(!p.loop)}
          />
          <TimelineButton
            label="Snap to frames and nearby timing"
            icon="magnet"
            active={p.snapping}
            onClick={() => p.setSnapping(!p.snapping)}
          />
        </div>
        <div
          className="row timeline-tools"
          role="group"
          aria-label="Timeline tools"
        >
          <TimelineButton
            label="Previous keyframe"
            icon="previousKeyframe"
            onClick={previousKey}
          />
          <TimelineButton
            label="Add keyframe at playhead"
            icon="addKeyframe"
            onClick={addKey}
            disabled={!hasSelection}
          />
          <TimelineButton
            label="Next keyframe"
            icon="nextKeyframe"
            onClick={nextKey}
          />
          <div className="timeline-speed">
            <SelectField
              label="Playback speed"
              value={String(p.speed)}
              onChange={(value) => p.setSpeed(Number(value))}
              options={[0.25, 0.5, 1, 1.5, 2].map((value) => ({
                value: String(value),
                label: `${value}× speed`,
              }))}
            />
          </div>
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
          <input
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
        <div className="timeline-fps">
          <SelectField
            label="Timeline frame rate"
            value={String(p.fps)}
            onChange={(value) => p.setFps(Number(value))}
            options={[24, 30, 60].map((value) => ({
              value: String(value),
              label: `${value} fps`,
            }))}
          />
        </div>
        <div
          className="row timeline-range-tools"
          role="group"
          aria-label="Preview range"
        >
          <TimelineButton
            label="Set preview range start (I)"
            icon="previousKeyframe"
            onClick={() =>
              p.setRange({
                start: clamp(
                  p.time,
                  0,
                  (p.range?.end ?? p.duration) - 1 / p.fps,
                ),
                end: p.range?.end ?? p.duration,
              })
            }
          />
          <TimelineButton
            label="Set preview range end (O)"
            icon="nextKeyframe"
            onClick={() =>
              p.setRange({
                start: p.range?.start ?? 0,
                end: clamp(
                  p.time,
                  (p.range?.start ?? 0) + 1 / p.fps,
                  p.duration,
                ),
              })
            }
          />
          {p.range && (
            <>
              <span className="timeline-range-readout">
                {p.range.start.toFixed(2)}–{p.range.end.toFixed(2)}s
              </span>
              <TimelineButton
                label="Clear preview range"
                icon="close"
                onClick={() => p.setRange(undefined)}
              />
            </>
          )}
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={p.reducedMotion}
            onChange={(ev) => p.setReducedMotion(ev.target.checked)}
          />
          Reduce motion
        </label>
        <button
          className="timeline-edit-button"
          onClick={p.edit}
          disabled={!p.preview}
        >
          <Icon name="rename" size={14} />
          Edit canvas
        </button>
      </div>
    </>
  );
}
