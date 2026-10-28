import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import { nodeElements, type LayerNode } from "./scene";
import type { Editor } from "./use-editor";
import { Icon, type IconName } from "../components/ui/icon";

const layerIcons: Record<string, IconName> = {
  frame: "layers",
  text: "text",
  img: "image",
  video: "film",
  rect: "box",
  ellipse: "circle",
  line: "line",
};

function isAnimated(o: {
  physics?: unknown;
  learning?: { animate?: boolean };
  animation?: {
    enter?: { preset?: string };
    exit?: { preset?: string };
    motion?: { preset?: string };
    text?: { preset?: string };
    keyframes?: unknown[];
  };
}): boolean {
  if (o.physics || (o.learning && o.learning.animate !== false)) return true;
  const a = o.animation;
  if (!a) return false;
  if ((a.keyframes?.length ?? 0) > 0) return true;
  return [
    a.enter?.preset,
    a.exit?.preset,
    a.motion?.preset,
    a.text?.preset,
  ].some((p) => p && p !== "none");
}

export const LayerTree = memo(
  function LayerTree({ editor: e }: { editor: Editor }) {
    const [closed, setClosed] = useState<Set<string>>(new Set());
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<"all" | "animated" | "text">("all");
    const [dragging, setDragging] = useState<string[]>([]);
    const [dropTarget, setDropTarget] = useState("");
    const [renaming, setRenaming] = useState<string | null>(null);
    const [draft, setDraft] = useState("");
    const host = useRef<HTMLDivElement>(null),
      anchor = useRef<string | undefined>(undefined);
    const selection = new Set(e.selection);

    useEffect(() => {
      const open = new Set<string>();
      const visit = (node: LayerNode, ancestors: string[]) => {
        if (node.element && selection.has(node.id))
          ancestors.forEach((id) => open.add(id));
        node.children.forEach((child) => visit(child, [...ancestors, node.id]));
      };
      e.scene.tree.forEach((n) => visit(n, []));
      setClosed((old) => {
        if (![...open].some((id) => old.has(id))) return old;
        const next = new Set(old);
        open.forEach((id) => next.delete(id));
        return next;
      });
    }, [e.selection, e.scene]);

    function toggle(id: string) {
      setClosed((old) => {
        const next = new Set(old);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }

    function choose(node: LayerNode, extend = false, additive = false) {
      const ids = node.element
        ? [node.id]
        : nodeElements(node).map((o) => o.id);
      if (extend && anchor.current) {
        const rows = Array.from(
          host.current?.querySelectorAll<HTMLElement>("[role=treeitem]") || [],
        );
        const from = rows.findIndex(
            (row) => row.dataset.layerId === anchor.current,
          ),
          to = rows.findIndex((row) => row.dataset.layerId === node.id);
        if (from >= 0 && to >= 0) {
          const selected = rows
            .slice(Math.min(from, to), Math.max(from, to) + 1)
            .flatMap(
              (row) => JSON.parse(row.dataset.selection || "[]") as string[],
            );
          e.select([...new Set([...e.selection, ...selected])]);
          return;
        }
      }
      e.select(
        additive
          ? ids.every((id) => selection.has(id))
            ? e.selection.filter((id) => !ids.includes(id))
            : [...new Set([...e.selection, ...ids])]
          : ids,
      );
      anchor.current = node.id;
    }

    function startRename(node: LayerNode, label: string) {
      if (!node.element) return;
      setRenaming(node.id);
      setDraft(label);
    }

    function commitRename(ids: string[]) {
      const value = draft.trim();
      if (value && value !== ids.map(() => "").join())
        e.patch({ n: value }, ids);
      setRenaming(null);
    }

    function row(node: LayerNode, depth: number): ReactNode {
      const o = node.element,
        members = o ? [o] : nodeElements(node),
        ids = members.map((o) => o.id);
      const branch = !!node.children.length || o?.t === "frame",
        expanded = !closed.has(node.id);
      const selected = ids.every((id) => selection.has(id)),
        hidden = members.every((o) => e.scene.isHidden(o)),
        locked = members.every((o) => e.scene.isLocked(o));
      const parentFrame = members[0]?.fid
        ? e.scene.byId.get(members[0].fid)
        : undefined;
      const label = o?.n || "Group";
      const q = query.trim().toLowerCase();
      const selfMatch =
        !q ||
        label.toLowerCase().includes(q) ||
        members.some((m) => m.n.toLowerCase().includes(q));
      const filterMatch =
        filter === "all" ||
        (filter === "text"
          ? members.some((m) => m.t === "text")
          : members.some((m) => isAnimated(m)));
      const children = branch
        ? node.children.map((child) => row(child, depth + 1))
        : [];
      const hasVisibleChild = children.some(Boolean);
      if ((q && !selfMatch && !hasVisibleChild) || !filterMatch) {
        // Still show ancestors of matching descendants.
        if (!hasVisibleChild) return null;
      }

      return (
        <div
          key={node.id}
          className="layer-branch"
          data-layer-id={node.id}
        >
          <div
            role="treeitem"
            aria-label={label}
            aria-level={depth + 1}
            aria-expanded={branch ? expanded : undefined}
            aria-selected={selected}
            tabIndex={0}
            data-layer-id={node.id}
            data-selection={JSON.stringify(ids)}
            className={`layer tree-layer ${selected ? "selected" : ""} ${o?.t === "frame" ? "frame-layer" : ""} ${hidden ? "is-hidden" : ""} ${dropTarget === node.id ? "drop-target" : ""}`}
            style={{ paddingLeft: Math.min(depth * 12, 48) + 6 }}
            draggable
            onClick={(ev) =>
              choose(node, ev.shiftKey, ev.metaKey || ev.ctrlKey)
            }
            onDoubleClick={() => {
              choose(node);
              if (branch) toggle(node.id);
            }}
            onDragStart={(ev) => {
              const source = selected ? e.selection : ids;
              setDragging(source);
              ev.dataTransfer.effectAllowed = "move";
              ev.dataTransfer.setData("genie/layers", JSON.stringify(source));
              // Slightly offset drag image for a Photoshop-like feel.
              if (ev.currentTarget instanceof HTMLElement)
                ev.dataTransfer.setDragImage(ev.currentTarget, 12, 12);
            }}
            onDragOver={(ev) => {
              if (!dragging.length) return;
              ev.preventDefault();
              ev.dataTransfer.dropEffect = "move";
              setDropTarget(node.id);
            }}
            onDragLeave={() => {
              if (dropTarget === node.id) setDropTarget("");
            }}
            onDrop={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              try {
                e.drop(
                  JSON.parse(ev.dataTransfer.getData("genie/layers")),
                  node.id,
                );
              } catch {
                e.notify("Could not reorder those layers.");
              }
              setDragging([]);
              setDropTarget("");
            }}
            onDragEnd={() => {
              setDragging([]);
              setDropTarget("");
            }}
            onKeyDown={(ev) => {
              if (ev.target !== ev.currentTarget) return;
              const rows = Array.from(
                  host.current?.querySelectorAll<HTMLElement>(
                    "[role=treeitem]",
                  ) || [],
                ),
                index = rows.indexOf(ev.currentTarget);
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(ev.key)) {
                ev.preventDefault();
                rows[
                  ev.key === "Home"
                    ? 0
                    : ev.key === "End"
                      ? rows.length - 1
                      : Math.max(
                          0,
                          Math.min(
                            rows.length - 1,
                            index + (ev.key === "ArrowDown" ? 1 : -1),
                          ),
                        )
                ]?.focus();
              }
              if (ev.key === "ArrowRight") {
                ev.preventDefault();
                if (branch && !expanded) toggle(node.id);
                else rows[index + 1]?.focus();
              }
              if (ev.key === "ArrowLeft") {
                ev.preventDefault();
                if (branch && expanded) toggle(node.id);
                else {
                  const previous = rows
                    .slice(0, index)
                    .reverse()
                    .find(
                      (row) =>
                        Number(row.getAttribute("aria-level")) < depth + 1,
                    );
                  previous?.focus();
                }
              }
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                choose(node, ev.shiftKey, ev.ctrlKey || ev.metaKey);
              }
              if (ev.key === "F2") {
                ev.preventDefault();
                startRename(node, label);
              }
              if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "d") {
                ev.preventDefault();
                e.duplicate();
              }
              if (ev.key === "Delete" || ev.key === "Backspace") {
                ev.preventDefault();
                e.remove();
              }
            }}
          >
            <span className="layer-grip" aria-hidden="true">
              <Icon name="grip" size={13} />
            </span>
            {branch ? (
              <Button
                className="layer-disclosure"
                aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
                tabIndex={-1}
                onClick={(ev) => {
                  ev.stopPropagation();
                  toggle(node.id);
                }}
              >
                <Icon name={expanded ? "down" : "right"} size={12} />
              </Button>
            ) : (
              <span className="layer-disclosure" />
            )}
            <span className="layer-icon" aria-hidden="true">
              {o?.t === "img" && o.src ? (
                <img
                  className="layer-thumb"
                  src={o.src}
                  alt=""
                  draggable={false}
                />
              ) : (
                <Icon name={o ? layerIcons[o.t] : "layers"} size={15} />
              )}
            </span>
            {renaming === node.id ? (
              <Input
                className="layer-rename"
                autoFocus
                value={draft}
                onChange={(ev) => setDraft(ev.target.value)}
                onBlur={() => commitRename(ids)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") {
                    ev.preventDefault();
                    commitRename(ids);
                  }
                  if (ev.key === "Escape") {
                    ev.preventDefault();
                    setRenaming(null);
                  }
                  ev.stopPropagation();
                }}
                onClick={(ev) => ev.stopPropagation()}
              />
            ) : (
              <span
                className="tree-layer-name"
                title="Double-click to rename"
                onDoubleClick={(ev) => {
                  ev.stopPropagation();
                  startRename(node, label);
                }}
              >
                {label}
              </span>
            )}
            {members.some((m) => isAnimated(m)) && (
              <span
                className="layer-anim-dot"
                title="Animated layer"
                aria-label="Animated layer"
              />
            )}
            {branch && (
              <small className="layer-count">
                {o?.t === "frame"
                  ? e.scene.frameChildren.get(o.id)?.length || 0
                  : members.length}
              </small>
            )}
            <span className="layer-actions">
              <Button
                disabled={!!parentFrame?.hide}
                aria-label={`${hidden ? "Show" : "Hide"} ${label}`}
                title={
                  parentFrame?.hide
                    ? "Hidden by its frame"
                    : hidden
                      ? "Show layer"
                      : "Hide layer"
                }
                onClick={(ev) => {
                  ev.stopPropagation();
                  e.patch({ hide: !hidden }, ids);
                }}
              >
                <Icon name={hidden ? "hidden" : "view"} size={13} />
              </Button>
              <Button
                disabled={!!parentFrame?.lock}
                aria-label={`${locked ? "Unlock" : "Lock"} ${label}`}
                title={
                  parentFrame?.lock
                    ? "Locked by its frame"
                    : locked
                      ? "Unlock layer"
                      : "Lock layer"
                }
                onClick={(ev) => {
                  ev.stopPropagation();
                  e.patch({ lock: !locked }, ids);
                }}
              >
                <Icon name={locked ? "lock" : "unlock"} size={13} />
              </Button>
            </span>
          </div>
          {branch && expanded && (
            <div role="group" data-layer-id={node.id}>
              {[...node.children]
                .reverse()
                .map((child) => row(child, depth + 1))}
              {!node.children.length && (
                <p
                  className="layer-empty"
                  style={{ paddingLeft: (depth + 1) * 12 + 22 }}
                >
                  Empty frame
                </p>
              )}
            </div>
          )}
        </div>
      );
    }

    return (
      <>
        <div className="section-title">
          <h2>Layers</h2>
          <span>{e.doc.elements.length}</span>
        </div>
        <div className="layer-toolbar">
          <Input
            className="layer-search"
            type="search"
            placeholder="Search layers"
            aria-label="Search layers"
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
          />
        </div>
        <div
          className="fx-chips layer-filter-chips"
          role="group"
          aria-label="Filter layers"
        >
          {(["all", "animated", "text"] as const).map((f) => (
            <Button
              key={f}
              type="button"
              className={filter === f ? "is-active" : ""}
              aria-pressed={filter === f}
              title={
                f === "all"
                  ? "Show all layers"
                  : f === "animated"
                    ? "Show only animated layers"
                    : "Show only text layers"
              }
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f === "animated" ? "Animated" : "Text"}
            </Button>
          ))}
        </div>
        <div
          ref={host}
          className="layers layer-tree"
          role="tree"
          aria-label="Canvas layers"
          aria-multiselectable="true"
          onDragOver={(ev) => {
            if (!dragging.length) return;
            ev.preventDefault();
            ev.dataTransfer.dropEffect = "move";
          }}
          onDrop={(ev) => {
            if (!dragging.length) return;
            // Rows stop propagation, so this only fires for gaps between
            // rows and the empty area below the list (resolves to the
            // enclosing branch, or "" for the top level).
            const row = (ev.target as HTMLElement).closest?.(
              "[data-layer-id]",
            );
            const targetId = row ? row.getAttribute("data-layer-id")! : "";
            ev.preventDefault();
            ev.stopPropagation();
            try {
              e.drop(
                JSON.parse(ev.dataTransfer.getData("genie/layers")),
                targetId,
              );
            } catch {
              e.notify("Could not reorder those layers.");
            }
            setDragging([]);
            setDropTarget("");
          }}
        >
          {[...e.scene.tree].reverse().map((node) => row(node, 0))}
        </div>
        {!e.doc.elements.length && (
          <p className="empty">No layers yet. Add a frame to begin.</p>
        )}
      </>
    );
  },
  (previous, next) =>
    previous.editor.committed === next.editor.committed &&
    previous.editor.selection === next.editor.selection,
);
