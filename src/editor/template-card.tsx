import { PresetPreviewImage } from "./preset-preview-image";
import { Button } from "@/components/ui/button";
import type { Preset } from "./model";
import { TemplateThumbnail } from "./template-thumbnail";
import { Icon } from "../components/ui/icon";
import { templateFormat, type PresetSummary } from "./preset-catalog";

export function TemplateCard({
  preset,
  onPreview,
  favorite,
  onFavorite,
  onRemove,
  removed = false,
}: {
  preset: Preset | PresetSummary;
  onPreview: () => void;
  favorite: boolean;
  onFavorite: () => void;
  onRemove?: () => void;
  removed?: boolean;
}) {
  return (
    <article className="template-card">
      <div className="template-card-preview">
        <Button
          className="template-preview-button"
          aria-label={`Preview ${preset.name}`}
          onClick={onPreview}
        >
          {"file" in preset && preset.thumbnail ? (
            <div className="template-thumbnail">
              <PresetPreviewImage
                entry={preset}
                alt={`${preset.name} template preview`}
              />
            </div>
          ) : "objects" in preset ? (
            <TemplateThumbnail preset={preset} />
          ) : (
            <span>Preview unavailable</span>
          )}
        </Button>
        <Button
          className="template-favorite"
          aria-label={`${favorite ? "Unsave" : "Save"} favorite ${preset.name}`}
          aria-pressed={favorite}
          onClick={onFavorite}
        >
          <Icon name="bookmark" size={14} />
        </Button>
        <span className="template-category">
          {preset.useCases?.[0] || "content"}
        </span>
        {onRemove && (
          <Button
            className="template-remove"
            aria-label={`${removed ? "Restore" : "Remove from library"} ${preset.name}`}
            title={removed ? "Restore template" : "Remove from library"}
            onClick={onRemove}
          >
            <Icon name={removed ? "undo" : "delete"} size={14} />
          </Button>
        )}
      </div>
      <div className="template-caption">
        <strong title={preset.name}>{preset.name}</strong>
        <small>
          <span>{templateFormat(preset)}</span>
          <span>
            {"objects" in preset ? preset.objects.length : preset.elementCount}{" "}
            layers
          </span>
        </small>
      </div>
    </article>
  );
}
