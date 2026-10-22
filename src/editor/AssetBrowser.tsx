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
import { assetMime, libraryAssets, type LibraryAsset } from "./assets";
import "./assets.css";

const rowHeight = 158;
function displayAssetName(name: string) {
  return name.replace(/\s*\(\d+\)\s*$/g, "").trim();
}
export const AssetBrowser = memo(function AssetBrowser({
  onChoose,
  pendingId,
}: {
  onChoose: (asset: LibraryAsset) => void;
  pendingId?: string;
  slotName?: string;
}) {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("All assets");
  const query = useDeferredValue(search.trim().toLowerCase());
  const items = useMemo(
    () =>
      libraryAssets.filter(
        (asset) =>
          (category === "All assets" || asset.category === category) &&
          query
            .split(/\s+/)
            .every(
              (word) =>
                asset.keywords.includes(word) ||
                asset.name.toLowerCase().includes(word),
            ),
      ),
    [query, category],
  );
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
  }, [query, category]);
  const startRow = Math.max(
    0,
    Math.min(
      Math.floor(viewport.top / rowHeight) - 2,
      Math.ceil(items.length / viewport.columns),
    ),
  );
  const endRow = startRow + Math.ceil(viewport.height / rowHeight) + 4;
  const visible = items.slice(
    startRow * viewport.columns,
    endRow * viewport.columns,
  );
  return (
    <section className="asset-browser" aria-label="Asset library">
      <div className="asset-browser-head">
        <label className="asset-search">
          <Icon name="search" size={16} />
          <input
            aria-label="Search assets"
            placeholder="Search owls, laptop, books…"
            value={search}
            onChange={(ev) => setSearch(ev.target.value)}
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
        <SelectField
          label="Asset category"
          value={category}
          onChange={setCategory}
          options={[
            "All assets",
            "Owls",
            "Devices",
            "School",
            "Symbols",
            "Other",
          ].map((value) => ({ value, label: value }))}
        />
      </div>
      <div
        className="asset-scroll"
        ref={scroll}
        onScroll={(ev) => {
          const top = ev.currentTarget.scrollTop;
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
              }}
            >
              {visible.map((asset) => (
                <button
                  type="button"
                  className={`asset-card ${pendingId === asset.id ? "is-pending" : ""}`}
                  key={asset.id}
                  draggable
                  title={displayAssetName(asset.name)}
                  aria-label={`Use ${displayAssetName(asset.name)}`}
                  aria-pressed={pendingId === asset.id}
                  onClick={() => onChoose(asset)}
                  onDragStart={(ev) => {
                    ev.dataTransfer.setData(assetMime, asset.id);
                    ev.dataTransfer.effectAllowed = "copy";
                  }}
                >
                  <span className="asset-thumbnail">
                    <img
                      src={asset.thumbnail}
                      alt=""
                      width={96}
                      height={96}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      onError={(ev) => {
                        ev.currentTarget.style.visibility = "hidden";
                        ev.currentTarget.parentElement?.setAttribute(
                          "data-error",
                          "Preview unavailable",
                        );
                      }}
                    />
                  </span>
                  <span className="asset-name">{displayAssetName(asset.name)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="assets-empty">
            <Icon name="search" size={24} />
            <strong>No matching assets</strong>
            <p>Try another word or category.</p>
            <button
              onClick={() => {
                setSearch("");
                setCategory("All assets");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </section>
  );
});
