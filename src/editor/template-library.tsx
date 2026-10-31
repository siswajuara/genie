import { PresetPreviewImage } from "./preset-preview-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { localStore } from "../lib/local-store";
import { saveExport, exportMessage } from "../lib/export";
import { slugify } from "./identifiers";
import {
  loadPreset,
  loadPresetCatalog,
  templateFormat,
  useCases,
  type PresetSummary,
} from "./preset-catalog";
import type { Preset } from "./model";
import type { Editor } from "./use-editor";
import { TemplateCard } from "./template-card";
import { TemplateThumbnail } from "./template-thumbnail";
import { resolvePresetAssets } from "./resolve-assets";
import { fitPresetToFrame } from "./preset-layout";
import { loadAsset, matchLibraryAsset, useAssetLibrary } from "./assets";

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
type Entry = Preset | PresetSummary;
const identity = (p: Entry) =>
  "file" in p ? `catalog:${p.identifier}` : `local:${p.identifier || p.name}`;
const removalsKey = "genie.removed-presets.v1";
function readList(key: string): string[] {
  try {
    const value: unknown = JSON.parse(localStore.getItem(key) || "[]");
    return Array.isArray(value)
      ? value.filter((v) => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

export function TemplateLibrary({
  editor,
  saved,
  onSave,
  onImport,
}: {
  editor: Editor;
  saved: Preset[];
  onSave: (next: Preset[]) => void;
  onImport: (text: string) => void;
}) {
  const [catalog, setCatalog] = useState<PresetSummary[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [collection, setCollection] = useState("all"),
    [format, setFormat] = useState("all"),
    [sort, setSort] = useState("curated");
  const [favorites, setFavorites] = useState(() =>
    readList("genie.template-favorites"),
  );
  const [removed, setRemoved] = useState(() => readList(removalsKey));
  const [preview, setPreview] = useState<Entry>(),
    [loaded, setLoaded] = useState<Preset>(),
    [previewError, setPreviewError] = useState(""),
    [busy, setBusy] = useState(false);
  const [original, setOriginal] = useState("");
  const [saving, setSaving] = useState(false),
    [name, setName] = useState(""),
    [saveCategory, setSaveCategory] = useState("content");
  const input = useRef<HTMLInputElement>(null),
    pack = useAssetLibrary();
  const comparisonRequest = useRef(0);
  useEffect(() => {
    let live = true;
    setCatalog([]);
    setPreview(undefined);
    setLoading(true);
    setError("");
    void loadPresetCatalog()
      .then((value) => {
        if (live) setCatalog(value.presets);
      })
      .catch((e) => {
        if (live) setError(String(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [retry, pack.revision]);
  useEffect(() => {
    let live = true;
    setLoaded(undefined);
    setPreviewError("");
    setOriginal("");
    comparisonRequest.current++;
    if (preview)
      void loadPreset(preview)
        .then(resolvePresetAssets)
        .then((p) => {
          if (live) setLoaded(p);
        })
        .catch((e) => {
          if (live) setPreviewError(String(e));
        });
    return () => {
      live = false;
    };
  }, [preview, pack.revision]);
  const entries = useMemo(() => [...catalog, ...saved], [catalog, saved]);
  const previewRemoved = !!preview && removed.includes(identity(preview));
  const fittedPreview = useMemo(
    () => loaded && editor.frame ? fitPresetToFrame(loaded, editor.frame) : loaded,
    [loaded, editor.frame?.w, editor.frame?.h],
  );
  const collections = Array.from(
    new Set(entries.map((e) => e.collection || "Classic")),
  )
    .filter((c) => c !== "My templates")
    .sort();
  const result = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    const items = entries.filter((p) => {
      const text = normalize(
        [
          p.name,
          p.description,
          p.identifier,
          p.collection,
          ...(p.tags || []),
          ...(p.useCases || []),
        ].join(" "),
      );
      return (
        removed.includes(identity(p)) === (collection === "removed") &&
        terms.every((t) => text.includes(t)) &&
        (category === "all" ||
          (p.useCases || ["content"]).includes(category)) &&
        (["all", "removed"].includes(collection) ||
          (collection === "favorites"
            ? favorites.includes(identity(p))
            : collection === "mine"
              ? "objects" in p
              : (p.collection || "Classic") === collection)) &&
        (format === "all" || templateFormat(p) === format)
      );
    });
    if (sort === "az") items.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "za") items.sort((a, b) => b.name.localeCompare(a.name));
    return items;
  }, [entries, query, category, collection, favorites, format, sort, removed]);
  function toggleFavorite(p: Entry) {
    const id = identity(p),
      next = favorites.includes(id)
        ? favorites.filter((v) => v !== id)
        : [...favorites, id];
    setFavorites(next);
    try {
      localStore.setItem("genie.template-favorites", JSON.stringify(next));
    } catch {
      editor.notify("Could not save favorites.");
    }
  }
  function toggleRemoved(p: Entry) {
    const id = identity(p),
      restoring = removed.includes(id);
    const next = restoring
      ? removed.filter((value) => value !== id)
      : [...removed, id];
    try {
      localStore.setItem(removalsKey, JSON.stringify(next));
      setRemoved(next);
      if (preview && identity(preview) === id) setPreview(undefined);
      editor.notify(
        restoring
          ? "Template restored to your library."
          : "Template removed from your library. Restore it from the Removed collection.",
      );
    } catch (e) {
      editor.notify(`Could not update your template library. ${String(e)}`);
    }
  }
  async function apply(replace: boolean) {
    if (!preview || busy || previewRemoved) return;
    setBusy(true);
    try {
      if (await editor.template(preview, replace)) setPreview(undefined);
    } finally {
      setBusy(false);
    }
  }
  async function compareOriginal() {
    if (original) {
      setOriginal("");
      return;
    }
    const target = preview;
    const request = ++comparisonRequest.current;
    if (!target?.reference) return;
    const asset = matchLibraryAsset(target.reference.assetIdentifier);
    if (!asset) {
      setPreviewError(
        "Connect the Siswa Juara asset pack to compare the original.",
      );
      return;
    }
    setBusy(true);
    try {
      const src = await loadAsset(asset);
      if (request === comparisonRequest.current) setOriginal(src);
    } catch (e) {
      if (request === comparisonRequest.current) setPreviewError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function exportPreset() {
    if (!loaded) return;
    try {
      const p = await resolvePresetAssets(loaded);
      editor.notify(
        exportMessage(
          await saveExport(
            new Blob([JSON.stringify(p, null, 2)], {
              type: "application/json",
            }),
            `${p.identifier || slugify(p.name)}.json`,
          ),
        ),
      );
    } catch (e) {
      setPreviewError(String(e));
    }
  }
  return (
    <section className="template-library" aria-label="Template library">
      <div className="template-sticky">
        <div className="template-library-tools">
        <Button
          onClick={() => {
            setName(editor.frame?.n || "My template");
            setSaving(true);
          }}
          disabled={!editor.frame}
        >
          <Icon name="add" size={13} />
          Save frame
        </Button>
        <Button onClick={() => input.current?.click()}>
          <Icon name="upload" size={13} />
          Import JSON
        </Button>
        <input
          hidden
          ref={input}
          type="file"
          accept=".json,application/json"
          aria-label="Import template JSON"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file)
              void file
                .text()
                .then(onImport)
                .catch((e) => editor.notify(String(e)));
            event.target.value = "";
          }}
        />
      </div>
      <div className="template-search">
        <Icon name="search" size={15} />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search layouts, topics, tags…"
          aria-label="Search templates"
        />
      </div>
      <div className="template-filter-grid">
        <SelectField
          label="Template use case"
          value={category}
          onChange={setCategory}
          options={[
            { value: "all", label: "Use case" },
            ...useCases.map((c) => ({ value: c, label: title(c) })),
          ]}
        />
        <SelectField
          label="Template collection"
          value={collection}
          onChange={setCollection}
          options={[
            { value: "all", label: "Collection" },
            { value: "favorites", label: "Favorites" },
            { value: "mine", label: "My templates" },
            { value: "removed", label: "Removed" },
            ...collections.map((c) => ({ value: c, label: c })),
          ]}
        />
        <SelectField
          label="Template format"
          value={format}
          onChange={setFormat}
          options={[
            { value: "all", label: "Format" },
            ...["Portrait", "Square", "Story", "Landscape", "Elements"].map(
              (c) => ({ value: c, label: c }),
            ),
          ]}
        />
      </div>
      <div className="template-results-bar">
        <span aria-live="polite">
          {result.length} {result.length === 1 ? "template" : "templates"}
        </span>
        <SelectField
          label="Sort templates"
          value={sort}
          onChange={setSort}
          options={[
            { value: "curated", label: "Featured" },
            { value: "az", label: "Name A–Z" },
            { value: "za", label: "Name Z–A" },
          ]}
        />
        </div>
      </div>
      {loading && (
        <p className="hint" role="status">
          Loading template catalog…
        </p>
      )}
      {error && (
        <div role="alert" className="template-empty">
          <p>{error}</p>
          <Button onClick={() => setRetry(retry + 1)}>Try again</Button>
        </div>
      )}
      <div className="template-list">
        {result.map((p, i) => (
          <TemplateCard
            key={`${identity(p)}:${i}`}
            preset={p}
            favorite={favorites.includes(identity(p))}
            onFavorite={() => toggleFavorite(p)}
            onPreview={() => setPreview(p)}
            onRemove={"file" in p ? () => toggleRemoved(p) : undefined}
            removed={removed.includes(identity(p))}
          />
        ))}
      </div>
      {!pack.connected && (
        <p className="hint">
          Connect an asset pack in Setting &gt; Assets to browse supplied
          templates. Saved templates and JSON imports are available here.
        </p>
      )}
      {!loading && !error && !result.length && (
        <div className="template-empty">
          <Icon name="search" size={24} />
          <strong>
            {collection === "removed" && !query
              ? "No removed templates"
              : "No matching templates"}
          </strong>
          <p>
            {collection === "removed"
              ? "Templates you remove can be restored here."
              : "Try another topic or clear your filters."}
          </p>
          <Button
            onClick={() => {
              setQuery("");
              setCategory("all");
              setCollection("all");
              setFormat("all");
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(undefined);
        }}
      >
        {preview && (
          <DialogContent
            className="template-preview-dialog"
            aria-describedby={undefined}
          >
            <header className="modal-head">
              <DialogTitle>{preview.name}</DialogTitle>
              <Button
                className="icon-btn"
                aria-label="Close template preview"
                onClick={() => setPreview(undefined)}
              >
                <Icon name="close" size={16} />
              </Button>
            </header>
            <div className="template-preview-body">
              <div className="template-large-preview">
                {original ? (
                  <img
                    src={original}
                    alt="Original design reference for comparison"
                  />
                ) : fittedPreview ? (
                  <TemplateThumbnail preset={fittedPreview} />
                ) : "file" in preview && preview.thumbnail ? (
                  <PresetPreviewImage entry={preview} alt="Template preview" />
                ) : (
                  <p>Loading preview…</p>
                )}
              </div>
              <div className="template-preview-details">
                <span className="template-eyebrow">
                  {preview.collection || "My templates"}
                </span>
                <h3>{preview.name}</h3>
                <p>
                  {preview.description ||
                    "A reusable layout with editable layers."}
                </p>
                <div className="template-tags">
                  {(preview.useCases || ["content"]).map((c) => (
                    <span key={c}>{title(c)}</span>
                  ))}
                </div>
                <p className="hint">
                  {templateFormat(preview)} · {preview.W || 1122} ×{" "}
                  {preview.H || 1402}
                  {loaded ? ` · ${loaded.objects.length} layers` : ""}
                </p>
                {editor.frame && !previewRemoved && (
                  <p className="hint">
                    Automatically fits your selected frame: {editor.frame.w} ×{" "}
                    {editor.frame.h}.
                  </p>
                )}
                {preview.reference && (
                  <p className="hint">
                    Text, artwork, panels, and ornaments are separate layers.
                    Logo and handle sit above the content. Bottom space is reserved for subtitles. Reconstructed
                    areas and fonts may vary from the source.
                  </p>
                )}
                {previewError && (
                  <p role="alert" className="hint">
                    {previewError}
                  </p>
                )}
                <Button
                  className="primary"
                  disabled={busy || (!loaded && !previewRemoved)}
                  onClick={() =>
                    previewRemoved ? toggleRemoved(preview) : void apply(false)
                  }
                >
                  <Icon name={previewRemoved ? "undo" : "add"} size={15} />
                  {busy
                    ? "Loading…"
                    : previewRemoved
                      ? "Restore template"
                      : preview.kind === "object"
                        ? "Add elements"
                        : "Add frame"}
                </Button>
                {preview.kind === "template" && !previewRemoved && (
                  <Button
                    disabled={busy || !editor.frame || !loaded}
                    onClick={() => void apply(true)}
                  >
                    Replace selected frame
                  </Button>
                )}
                {preview.reference && (
                  <Button
                    disabled={busy}
                    onClick={() => void compareOriginal()}
                  >
                    {original
                      ? "Show editable design"
                      : "Compare original reference"}
                  </Button>
                )}
                <Button disabled={!loaded} onClick={() => void exportPreset()}>
                  <Icon name="export" size={14} />
                  Export template JSON
                </Button>
                {"file" in preview && !previewRemoved && (
                  <Button
                    className="danger"
                    disabled={busy}
                    onClick={() => toggleRemoved(preview)}
                  >
                    <Icon name="delete" size={14} />
                    Remove from library
                  </Button>
                )}
                {"objects" in preview && (
                  <Button
                    className="danger"
                    onClick={() => {
                      onSave(saved.filter((p) => p !== preview));
                      setPreview(undefined);
                    }}
                  >
                    Delete saved template
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
      <Dialog open={saving} onOpenChange={setSaving}>
        <DialogContent className="modal-dialog" aria-describedby={undefined}>
          <header className="modal-head">
            <DialogTitle>Save frame as template</DialogTitle>
            <Button
              className="icon-btn"
              aria-label="Close save template"
              onClick={() => setSaving(false)}
            >
              <Icon name="close" size={16} />
            </Button>
          </header>
          <form
            className="template-save-form"
            onSubmit={(event) => {
              event.preventDefault();
              try {
                const p = editor.preset("template", name.trim());
                p.useCases = [saveCategory];
                onSave([...saved, p]);
                setSaving(false);
                setCollection("mine");
                editor.notify("Template saved locally.");
              } catch (e) {
                editor.notify(String(e));
              }
            }}
          >
            <label>
              Template name
              <Input
                aria-label="Template name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
              />
            </label>
            <label>
              Use case
              <SelectField
                label="Saved template use case"
                value={saveCategory}
                onChange={setSaveCategory}
                options={useCases.map((c) => ({ value: c, label: title(c) }))}
              />
            </label>
            <Button className="primary" type="submit" disabled={!name.trim()}>
              Save template
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
