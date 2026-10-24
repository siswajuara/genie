import type { Preset } from "./model";
import { TemplateThumbnail } from "./TemplateThumbnail";
import { Icon } from "../components/ui/Icon";

function format(preset: Preset) {
  if (preset.kind !== "template") return `${preset.objects.length} elements`;
  const ratio = (preset.W || 1122) / (preset.H || 1402);
  return ratio < 0.65
    ? "Story"
    : ratio > 1.15
      ? "Landscape"
      : ratio > 0.95
        ? "Square"
        : "Portrait";
}
export function TemplateCard({
  preset,
  canReplace,
  onApply,
  onDelete,
}: {
  preset: Preset;
  canReplace: boolean;
  onApply: (replace?: boolean) => void;
  onDelete?: () => void;
}) {
  return (
    <article className="template-card">
      <div className="template-card-preview">
        <button
          className="template-preview-button"
          aria-label={`Use ${preset.name}`}
          onClick={() => onApply()}
        >
          <TemplateThumbnail preset={preset} />
        </button>
        <div className="template-card-actions">
          <button className="primary" onClick={() => onApply()}>
            <Icon name="add" size={14} />
            {preset.kind === "template" ? "Use template" : "Add elements"}
          </button>
          {preset.kind === "template" && (
            <button
              disabled={!canReplace}
              title={
                canReplace
                  ? "Replace the selected frame"
                  : "Select a frame first"
              }
              onClick={() => onApply(true)}
            >
              <Icon name="layers" size={14} />
              Replace frame
            </button>
          )}
        </div>
        {onDelete && (
          <button
            className="template-delete danger"
            aria-label={`Delete ${preset.name}`}
            title="Delete template"
            onClick={onDelete}
          >
            <Icon name="delete" size={15} />
          </button>
        )}
      </div>
      <div className="template-caption">
        <strong title={preset.name}>{preset.name}</strong>
        <small>
          <span>{format(preset)}</span>
          {preset.kind === "template" && (
            <span>
              {preset.W || 1122} × {preset.H || 1402}
            </span>
          )}
          {preset.kind === "template" && (
            <span>{preset.scene?.duration ?? 6}s animated</span>
          )}
        </small>
      </div>
    </article>
  );
}
