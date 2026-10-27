import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Icon } from "@/components/ui/icon";
import { portalContainer } from "@/components/ui/portal-container";
import { rankedSceneTemplates, sceneTemplate } from "./generation";
import type { PresetSummary } from "./preset-catalog";
import { PresetPreviewImage } from "./preset-preview-image";

export function GenerateTemplatePicker({
  catalog,
  useCase,
  context,
  value,
  recommended,
  onChange,
  disabled,
}: {
  catalog: PresetSummary[];
  useCase: string;
  context: string;
  value: string;
  recommended?: PresetSummary;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const selected = sceneTemplate(
    catalog,
    useCase,
    context,
    value || recommended?.identifier,
  );
  const entries = rankedSceneTemplates(catalog, useCase, context).filter(
    (entry) => {
      const text =
        `${entry.identifier} ${entry.name} ${entry.collection || ""} ${entry.description || ""} ${(entry.tags || []).join(" ")} ${(entry.useCases || []).join(" ")}`.toLowerCase();
      return query
        .toLowerCase()
        .split(/\s+/)
        .every((term) => text.includes(term));
    },
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={setAnchor}
          className="generate-template-trigger"
          disabled={disabled}
          aria-label="Change scene template"
        >
          <span>
            <strong>{selected?.name || "Choose a template"}</strong>
            <small>
              {value ? "Selected template" : "Recommended for this scene"}
            </small>
          </span>
          <Icon name="down" size={15} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        container={portalContainer(anchor)}
        className="generate-template-picker"
        align="start"
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className="generate-template-search">
          <Input
            autoFocus
            aria-label="Search all templates"
            placeholder={`Search ${catalog.filter((entry) => entry.kind === "template").length} templates…`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button
            size="sm"
            disabled={!value}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            Auto
          </Button>
        </div>
        <ScrollArea
          className="generate-template-results"
          aria-label="Available scene templates"
        >
          <div className="generate-template-list">
            {entries.map((entry) => (
              <Button
                key={entry.identifier}
                className="generate-template-option"
                aria-pressed={selected?.identifier === entry.identifier}
                onClick={() => {
                  onChange(entry.identifier);
                  setOpen(false);
                }}
              >
                <PresetPreviewImage entry={entry} alt="" />
                <span>
                  <strong>{entry.name}</strong>
                  <small>{(entry.useCases || []).join(" · ")}</small>
                </span>
                {selected?.identifier === entry.identifier && (
                  <Icon name="check" size={14} />
                )}
              </Button>
            ))}
            {!entries.length && <p>No matching templates.</p>}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
