import { Button } from "@/components/ui/button";
import type { Preset } from "./model";
import { TemplateThumbnail } from "./template-thumbnail";
import { Icon } from "../components/ui/icon";

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
        <Button
          className="template-preview-button"
          aria-label={`Use ${preset.name}`}
          onClick={() => onApply()}
        >
          <TemplateThumbnail preset={preset} />
        </Button>
        <div className="template-card-actions">
          <Button className="primary" onClick={() => onApply()}>
            <Icon name="add" size={14} />
            {preset.kind === "template" ? "Add Frame" : "Add elements"}
          </Button>
          {preset.kind === "template" && (
            <Button
              disabled={!canReplace}
              title={
                canReplace
                  ? "Replace the selected frame"
                  : "Select a frame first"
              }
              onClick={() => onApply(true)}
            >
              <Icon name="layers" size={14} />
              Replace
            </Button>
          )}
        </div>
        {onDelete && (
          <Button
            className="template-delete danger"
            aria-label={`Delete ${preset.name}`}
            title="Delete template"
            onClick={onDelete}
          >
            <Icon name="delete" size={15} />
          </Button>
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
