import {
  memo,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon } from "../components/ui/Icon";
import { SelectField } from "../components/ui/Controls";
import {
  assetMime,
  libraryAssets,
  useAssetLibrary,
  loadAssetBlob,
  setDraggedAssetId,
  type LibraryAsset,
} from "./assets";
import { AssetThumbnail } from "./AssetThumbnail";
import { type CanvasAsset } from "./canvasAssets";
import "./assets.css";
export function personalLibraryAsset(asset: CanvasAsset): LibraryAsset {
  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    chromaKey: asset.chromaKey,
    file: asset.name,
    category:
      asset.source === "generated"
        ? "Generated"
        : asset.source === "upload"
          ? "Uploads"
          : "Canvas",
    image: asset.src,
    thumbnail: asset.type === "video" ? "" : asset.src,
    width: asset.width,
    height: asset.height,
    keywords:
      `${asset.name} ${asset.source} ${asset.type || "image"} ${asset.prompt || ""}`.toLowerCase(),
    identifier:
      asset.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "image",
  };
}
async function downloadAsset(asset: LibraryAsset) {
  const blob = await loadAssetBlob(asset);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const extension =
    blob.type.split("/")[1]?.replace("svg+xml", "svg").replace("jpeg", "jpg") ||
    "webp";
  link.download = /\.[a-z0-9]{2,5}$/i.test(asset.file)
    ? asset.file
    : `${asset.identifier}.${extension}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const AssetBrowser = memo(function AssetBrowser({
  onChoose,
  pendingId,
  assets = [],
  canvasImages = [],
  onAdd,
  onRename,
  onRemove,
}: {
  onChoose: (asset: LibraryAsset) => void;
  pendingId?: string;
  assets?: CanvasAsset[];
  canvasImages?: CanvasAsset[];
  onAdd?: (assets: CanvasAsset[]) => void;
  onRename?: (id: string, name: string) => void;
  onRemove?: (id: string) => void;
}) {
  const pack = useAssetLibrary();
  const [packError, setPackError] = useState("");
  const [source, setSource] = useState("Library"),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("All assets"),
    [renaming, setRenaming] = useState<LibraryAsset>(),
    [name, setName] = useState(""),
    [removing, setRemoving] = useState<LibraryAsset>();
  const query = useDeferredValue(search.trim().toLowerCase());
  // Library cards are thumbnail + name only; other tabs add an action row.
  const rowHeight = source === "Library" ? 140 : 172;
  const items = useMemo(() => {
    const list =
      source === "Library"
        ? libraryAssets
        : (source === "On canvas" ? canvasImages : assets).map(
            personalLibraryAsset,
          );
    return list.filter(
      (asset) =>
        (category === "All assets" || asset.category === category) &&
        query
          .split(/\s+/)
          .every(
            (word) =>
              asset.keywords.includes(word) ||
              asset.name.toLowerCase().includes(word),
          ),
    );
  }, [source, assets, canvasImages, category, query, pack.revision]);
  const scroll = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ height: 600, columns: 2, top: 0 });
  useEffect(() => {
    const element = scroll.current!;
    const observer = new ResizeObserver(() =>
      setViewport((old) => ({
        ...old,
        height: element.clientHeight,
        columns: Math.max(1, Math.floor(element.clientWidth / 110)),
      })),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    scroll.current?.scrollTo({ top: 0 });
    setViewport((old) => ({ ...old, top: 0 }));
  }, [source, query, category]);
  const startRow = Math.max(
      0,
      Math.min(
        Math.floor(viewport.top / rowHeight) - 2,
        Math.ceil(items.length / viewport.columns),
      ),
    ),
    endRow = startRow + Math.ceil(viewport.height / rowHeight) + 4,
    visible = items.slice(
      startRow * viewport.columns,
      endRow * viewport.columns,
    );
  return (
    <section className="asset-browser" aria-label="Asset library">
      <div className="asset-browser-head">
        <div
          className="asset-library-tabs"
          role="group"
          aria-label="Asset source"
        >
          {["My assets", "On canvas", "Library"].map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={source === value}
              onClick={() => {
                setSource(value);
                setCategory("All assets");
              }}
            >
              {value}
            </button>
          ))}
        </div>
        <label className="asset-search">
          <Icon name="search" size={16} />
          <input
            aria-label="Search assets"
            placeholder="Search by name or subject"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button
              type="button"
              aria-label="Clear asset search"
              onClick={() => setSearch("")}
            >
              <Icon name="close" size={13} />
            </button>
          )}
        </label>
        {source === "Library" && (
          <SelectField
            label="Asset category"
            value={category}
            onChange={setCategory}
            options={[
              "All assets",
              ...new Set(libraryAssets.map((asset) => asset.category)),
            ].map((value) => ({ value, label: value }))}
          />
        )}
        {packError && (
          <p className="asset-error" role="alert">
            {packError}
          </p>
        )}
        {renaming && (
          <div className="asset-manage-row">
            <label>
              Asset name
              <input
                aria-label="Asset name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && name.trim()) {
                    onRename?.(renaming.id, name);
                    setRenaming(undefined);
                  }
                  if (event.key === "Escape") setRenaming(undefined);
                }}
              />
            </label>
            <button
              type="button"
              disabled={!name.trim()}
              onClick={() => {
                onRename?.(renaming.id, name);
                setRenaming(undefined);
              }}
            >
              Save name
            </button>
            <button type="button" onClick={() => setRenaming(undefined)}>
              Cancel
            </button>
          </div>
        )}
        {removing && (
          <div className="asset-manage-row">
            <p>
              Remove “{removing.name}” from My assets? Media already placed on
              pages stays in place.
            </p>
            <button
              type="button"
              className="danger"
              onClick={() => {
                onRemove?.(removing.id);
                setRemoving(undefined);
              }}
            >
              Remove from library
            </button>
            <button type="button" onClick={() => setRemoving(undefined)}>
              Keep asset
            </button>
          </div>
        )}
      </div>
      <div
        className="asset-scroll"
        ref={scroll}
        onScroll={(event) => {
          const top = event.currentTarget.scrollTop;
          setViewport((old) =>
            Math.floor(old.top / rowHeight) === Math.floor(top / rowHeight)
              ? old
              : { ...old, top },
          );
        }}
      >
        {items.length ? (
          <div
            className="asset-grid-space"
            style={{
              height: Math.ceil(items.length / viewport.columns) * rowHeight,
            }}
          >
            <div
              className="asset-grid-window"
              style={{
                transform: `translateY(${startRow * rowHeight}px)`,
                gridTemplateColumns: `repeat(${viewport.columns},minmax(0,1fr))`,
                gridAutoRows: `${rowHeight}px`,
              }}
            >
              {visible.map((asset) => (
                <article
                  className={`asset-card ${pendingId === asset.id ? "is-pending" : ""}`}
                  key={asset.id}
                >
                  <button
                    type="button"
                    className="asset-use"
                    draggable
                    title={asset.name}
                    aria-label={`Use ${asset.name}`}
                    aria-pressed={pendingId === asset.id}
                    onClick={() => onChoose(asset)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData(assetMime, asset.id);
                      event.dataTransfer.effectAllowed = "copy";
                      setDraggedAssetId(asset.id);
                    }}
                    onDragEnd={() => setDraggedAssetId(undefined)}
                  >
                    <span className="asset-thumbnail">
                      <AssetThumbnail asset={asset} />
                      {asset.type === "video" && (
                        <span className="asset-duration">
                          {asset.duration
                            ? `${asset.duration.toFixed(1)}s`
                            : "Video"}
                        </span>
                      )}
                    </span>
                    <span className="asset-name">{asset.name}</span>
                  </button>
                  {source !== "Library" && (
                    <div className="asset-card-actions">
                      {source === "My assets" ? (
                        <>
                          <button
                            type="button"
                            title="Rename"
                            aria-label={`Rename ${asset.name}`}
                            onClick={() => {
                              setRenaming(asset);
                              setName(asset.name);
                              setRemoving(undefined);
                            }}
                          >
                            <Icon name="rename" size={13} />
                          </button>
                          <button
                            type="button"
                            title="Download"
                            aria-label={`Download ${asset.name}`}
                            onClick={() => {
                              void downloadAsset(asset).catch((error) =>
                                setPackError(String(error)),
                              );
                            }}
                          >
                            <Icon name="export" size={13} />
                          </button>
                          <button
                            type="button"
                            title="Remove from library"
                            aria-label={`Remove ${asset.name} from library`}
                            onClick={() => {
                              setRemoving(asset);
                              setRenaming(undefined);
                            }}
                          >
                            <Icon name="delete" size={13} />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={assets.some(
                            (saved) => saved.src === asset.image,
                          )}
                          onClick={() => {
                            const record = canvasImages.find(
                              (item) => item.id === asset.id,
                            );
                            if (record) onAdd?.([record]);
                          }}
                        >
                          {assets.some((saved) => saved.src === asset.image)
                            ? "Saved"
                            : "Save to library"}
                        </button>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="assets-empty">
            <Icon name="image" size={24} />
            <strong>
              {search
                ? "No matching assets"
                : source === "My assets"
                  ? "Your reusable media lives here"
                  : source === "On canvas"
                    ? "No media placed yet"
                    : "No matching assets"}
            </strong>
            <p>
              {source === "My assets"
                ? "Upload an image, or save placed media from On canvas."
                : "Try another source, name, or category."}
            </p>
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategory("All assets");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
});
