import { localStore } from "../lib/local-store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyPreset,
  copy,
  frames,
  initialDocument,
  parseDocument,
  stamp,
  uid,
  type CanvasDocument,
  type Element,
  type Preset,
} from "./model";
import { buildScene, dropLayer, orderLayers } from "./scene";
import { slugify } from "./identifiers";
import { loadAsset, matchLibraryAsset } from "./assets";
import { resolvePresetAssets, unresolvedAssetSlots } from "./resolve-assets";
import { brandImageSource } from "../lib/brand";

export function useEditor(
  initial?: CanvasDocument,
  onDocumentChange?: (doc: CanvasDocument) => void,
) {
  const [doc, setDoc] = useState<CanvasDocument>(() => {
    if (initial) return copy(initial);
    try {
      const saved = localStore.getItem("genie.canvas");
      if (saved) return parseDocument(JSON.parse(saved));
    } catch {
      /* An invalid saved document falls back to the reference template. */
    }
    return initialDocument();
  });
  const [selection, select] = useState<string[]>([]);
  const [notice, notify] = useState(
    "Ready. Select an element to edit its properties.",
  );
  const [storageError, setStorageError] = useState("");
  const history = useRef<CanvasDocument[]>([doc]);
  const [committed, setCommitted] = useState(doc);
  const cursor = useRef(0);
  const clipboard = useRef<Element[]>([]);
  const current = useRef(doc);
  current.current = doc;
  const onChange = useRef(onDocumentChange);
  const mounted = useRef(true),
    presetRequest = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      presetRequest.current++;
    };
  }, []);
  onChange.current = onDocumentChange;
  const change = useCallback((next: CanvasDocument, commit = true) => {
    const value = stamp(next);
    current.current = value;
    if (!mounted.current) {
      onChange.current?.(value);
      return;
    }
    setDoc(value);
    const previous = history.current[cursor.current];
    if (commit) setCommitted(value);
    if (
      commit &&
      (previous.elements.length !== value.elements.length ||
        previous.elements.some((o, i) => o !== value.elements[i]) ||
        previous.metadata.name !== value.metadata.name)
    ) {
      history.current = history.current.slice(0, cursor.current + 1);
      history.current.push(value);
      if (history.current.length > 80) history.current.shift();
      cursor.current = history.current.length - 1;
    }
  }, []);
  useEffect(() => {
    let live = true;
    const slots = unresolvedAssetSlots(current.current.elements);
    if (slots.length)
      void resolvePresetAssets({
        name: "Initial canvas assets",
        kind: "object",
        objects: slots,
      }).then((resolved) => {
        if (!live || !mounted.current) return;
        const replacements = new Map(
          resolved.objects.filter((o) => o.src).map((o) => [o.id, o]),
        );
        if (!replacements.size) return;
        const document = current.current;
        const elements = document.elements.map((o) => {
          const match = replacements.get(o.id);
          return match && !o.src && o.identifier === match.identifier
            ? { ...o, src: match.src, fit: o.fit || "contain" }
            : o;
        });
        if (elements.some((o, i) => o !== document.elements[i]))
          change({ ...document, elements });
      });
    return () => {
      live = false;
    };
  }, [change]);
  const commit = () => change(current.current);
  useEffect(() => {
    if (onChange.current) {
      onChange.current(committed);
      return;
    }
    const id = setTimeout(() => {
      try {
        localStore.setItem("genie.canvas", JSON.stringify(committed));
        setStorageError("");
      } catch {
        setStorageError(
          "This design could not be saved. Check Settings > Storage or export a JSON backup.",
        );
      }
    }, 350);
    return () => clearTimeout(id);
  }, [committed]);
  const scene = useMemo(() => buildScene(doc.elements), [doc.elements]);
  const selected = selection
    .map((id) => scene.byId.get(id))
    .filter((o): o is Element => !!o);
  const active = selected[selected.length - 1];
  const frame =
    (active?.t === "frame" ? active : scene.byId.get(active?.fid || "")) ||
    scene.frames[0];
  const expanded = (ids = selection) => {
    const chosen = new Set(ids);
    return doc.elements.filter(
      (o) => chosen.has(o.id) || (o.fid && chosen.has(o.fid)),
    );
  };
  const patch = (patch: Partial<Element>, ids = selection) => {
    const live = current.current,
      chosen = new Set(ids);
    const offsets = new Map(
      live.elements
        .filter((o) => o.t === "frame" && chosen.has(o.id))
        .map((o) => [
          o.id,
          { x: (patch.x ?? o.x) - o.x, y: (patch.y ?? o.y) - o.y },
        ]),
    );
    change({
      ...live,
      elements: live.elements.map((o) => {
        if (chosen.has(o.id))
          return Object.entries(patch).every(
            ([key, value]) =>
              (o as unknown as Record<string, unknown>)[key] === value,
          )
            ? o
            : { ...o, ...patch };
        const offset = o.fid ? offsets.get(o.fid) : undefined;
        return offset && (offset.x || offset.y)
          ? { ...o, x: o.x + offset.x, y: o.y + offset.y }
          : o;
      }),
    });
  };
  function undo() {
    if (cursor.current > 0) {
      cursor.current--;
      const next = stamp(history.current[cursor.current]);
      current.current = next;
      setDoc(next);
      setCommitted(next);
      select(selection.filter((id) => next.elements.some((o) => o.id === id)));
    }
  }
  function redo() {
    if (cursor.current < history.current.length - 1) {
      cursor.current++;
      const next = stamp(history.current[cursor.current]);
      current.current = next;
      setDoc(next);
      setCommitted(next);
      select(selection.filter((id) => next.elements.some((o) => o.id === id)));
    }
  }
  function remove() {
    const ids = expanded().map((o) => o.id);
    change({
      ...doc,
      elements: doc.elements.filter((o) => !ids.includes(o.id)),
    });
    select([]);
  }
  function paste(source = clipboard.current, at?: { x: number; y: number }) {
    if (!source.length) return;
    const live = current.current;
    const target = at
      ? frames(live).findLast(
          (f) =>
            !f.hide &&
            !f.lock &&
            at.x >= f.x &&
            at.x <= f.x + f.w &&
            at.y >= f.y &&
            at.y <= f.y + f.h,
        )
      : frame;
    const idMap = new Map(source.map((o) => [o.id, uid()]));
    const groupMap = new Map(
      source
        .filter((o) => o.gid)
        .map((o) => [`${o.fid || ""}:${o.gid}`, uid()]),
    );
    const dx = at ? at.x - Math.min(...source.map((o) => o.x)) : 24;
    const dy = at ? at.y - Math.min(...source.map((o) => o.y)) : 24;
    const objects = source.map((o) => ({
      ...copy(o),
      id: idMap.get(o.id)!,
      x: o.x + dx,
      y: o.y + dy,
      n: o.n + " copy",
      gid: o.gid ? groupMap.get(`${o.fid || ""}:${o.gid}`) : undefined,
      fid:
        o.t === "frame"
          ? undefined
          : o.fid && idMap.has(o.fid)
            ? idMap.get(o.fid)
            : at
              ? target?.id
              : o.fid && live.elements.some((f) => f.id === o.fid)
                ? o.fid
                : target?.id,
    }));
    change({ ...live, elements: [...live.elements, ...objects] });
    select(objects.map((o) => o.id));
  }
  function add(o: Element, at?: { x: number; y: number }) {
    const live = current.current;
    const target = at
      ? frames(live).findLast(
          (f) =>
            !f.hide &&
            !f.lock &&
            at.x >= f.x &&
            at.x <= f.x + f.w &&
            at.y >= f.y &&
            at.y <= f.y + f.h,
        )
      : frame;
    if (!target) {
      const center = at || { x: 300, y: 300 };
      o = {
        ...o,
        fid: undefined,
        x: center.x - o.w / 2,
        y: center.y - o.h / 2,
      };
      change({ ...live, elements: [...live.elements, o] });
      select([o.id]);
      return;
    }
    const k = Math.min(
      1,
      (target.w * 0.92) / Math.max(1, o.w),
      (target.h * 0.92) / Math.max(1, o.h),
    );
    o = {
      ...o,
      w: o.w * k,
      h: o.h * k,
      size: o.size ? o.size * k : undefined,
      fid: target.id,
    };
    o.x = Math.max(
      target.x,
      Math.min(
        (at?.x ?? target.x + target.w / 2) - o.w / 2,
        target.x + target.w - o.w,
      ),
    );
    o.y = Math.max(
      target.y,
      Math.min(
        (at?.y ?? target.y + target.h / 2) - o.h / 2,
        target.y + target.h - o.h,
      ),
    );
    change({ ...live, elements: [...live.elements, o] });
    select([o.id]);
  }
  function addFrame(w: number, h: number, name: string) {
    const f: Element = {
      id: uid(),
      t: "frame",
      n: name,
      x: Math.max(20, ...frames(doc).map((o) => o.x + o.w + 100)),
      y: 80,
      w,
      h,
      fill: "#ffffff",
    };
    change({ ...doc, elements: [...doc.elements, f] });
    select([f.id]);
  }
  function duplicateFrame() {
    if (!frame) return;
    const source = doc.elements.filter(
      (o) => o.id === frame.id || o.fid === frame.id,
    );
    const idMap = new Map(source.map((o) => [o.id, uid()]));
    const groupMap = new Map(
      source.filter((o) => o.gid).map((o) => [o.gid!, uid()]),
    );
    const dx = Math.max(...frames(doc).map((f) => f.x + f.w)) + 100 - frame.x;
    const objects = source.map((o) => ({
      ...copy(o),
      id: idMap.get(o.id)!,
      x: o.x + dx,
      n: o.t === "frame" ? o.n + " copy" : o.n,
      fid: o.fid ? idMap.get(o.fid) : undefined,
      gid: o.gid ? groupMap.get(o.gid) : undefined,
    }));
    change({ ...doc, elements: [...doc.elements, ...objects] });
    select([idMap.get(frame.id)!]);
  }
  async function template(p: Preset, replace = false) {
    const request = ++presetRequest.current,
      targetId = frame?.id;
    try {
      notify("Loading preset assets…");
      const resolved = await resolvePresetAssets(p);
      if (!mounted.current || (replace && request !== presetRequest.current))
        return;
      const live = current.current;
      if (
        targetId &&
        !live.elements.some((o) => o.id === targetId) &&
        replace
      ) {
        notify("That frame was removed before the preset finished loading.");
        return;
      }
      const next = applyPreset(live, resolved, targetId, replace);
      change(next);
      select([
        (replace || p.kind === "object") && targetId
          ? targetId
          : frames(next).at(-1)!.id,
      ]);
      const images = resolved.objects.filter((o) => o.t === "img"),
        filled = images.filter((o) => o.src).length;
      notify(
        `${p.name} loaded. ${filled} image slots filled${images.length > filled ? `; ${images.length - filled} remain available for your own images` : ""}.`,
      );
    } catch (e) {
      notify(String(e));
    }
  }
  async function setIdentifier(value: string, ids = selection) {
    const identifier = slugify(value);
    if (!identifier) {
      notify("Use letters or numbers in the identifier.");
      return;
    }
    patch({ identifier }, ids);
    const asset = matchLibraryAsset(identifier);
    const brand = brandImageSource(identifier);
    const initialScene = buildScene(current.current.elements);
    const targets = current.current.elements.filter(
      (o) => ids.includes(o.id) && o.t === "img" && !initialScene.isLocked(o),
    );
    if (!targets.length) return;
    if (!asset && !brand) {
      notify(
        "No matching library asset. The current image is kept; you can choose one from Assets.",
      );
      return;
    }
    try {
      const src = brand || (await loadAsset(asset!));
      if (!mounted.current) return;
      const targetIds = new Set(targets.map((o) => o.id)),
        live = current.current,
        scene = buildScene(live.elements);
      const elements = live.elements.map((o) =>
        targetIds.has(o.id) && o.identifier === identifier && !scene.isLocked(o)
          ? { ...o, src, fit: o.fit || "contain" }
          : o,
      );
      if (elements.some((o, i) => o !== live.elements[i]))
        change({ ...live, elements });
    } catch (err) {
      if (mounted.current)
        notify(`The matching asset could not be loaded: ${String(err)}`);
    }
  }
  function order(direction: number, end = false) {
    change({
      ...doc,
      elements: orderLayers(doc.elements, selection, direction, end),
    });
  }
  function drop(sourceIds: string[], targetId: string) {
    const elements = dropLayer(doc.elements, sourceIds, targetId);
    if (elements === doc.elements) {
      notify(
        "Drag to a sibling layer to change its order. Use Parent frame to move between frames.",
      );
      return;
    }
    change({ ...doc, elements });
    select(sourceIds);
  }
  function moveToFrame(parentId: string) {
    const parent = scene.byId.get(parentId),
      items = expanded().filter((o) => o.t !== "frame");
    if (!items.length || (parentId && parent?.t !== "frame")) return;
    const chosen = new Set(items.map((o) => o.id));
    const x = Math.min(...items.map((o) => o.x)),
      y = Math.min(...items.map((o) => o.y));
    const w = Math.max(...items.map((o) => o.x + o.w)) - x,
      h = Math.max(...items.map((o) => o.y + o.h)) - y;
    const dx = parent ? parent.x + (parent.w - w) / 2 - x : 0,
      dy = parent ? parent.y + (parent.h - h) / 2 - y : 0;
    change({
      ...doc,
      elements: doc.elements.map((o) =>
        chosen.has(o.id)
          ? { ...o, fid: parent?.id, x: o.x + dx, y: o.y + dy, gid: undefined }
          : o,
      ),
    });
  }
  function align(axis: string) {
    const items = selected.filter((o) => o.t !== "frame");
    if (!items.length || !frame) return;
    const a = items.length === 1 ? frame.x : Math.min(...items.map((o) => o.x));
    const b = items.length === 1 ? frame.y : Math.min(...items.map((o) => o.y));
    const c =
      items.length === 1
        ? frame.x + frame.w
        : Math.max(...items.map((o) => o.x + o.w));
    const d =
      items.length === 1
        ? frame.y + frame.h
        : Math.max(...items.map((o) => o.y + o.h));
    change({
      ...doc,
      elements: doc.elements.map((o) =>
        items.includes(o)
          ? {
              ...o,
              x:
                axis === "Left"
                  ? a
                  : axis === "Right"
                    ? c - o.w
                    : axis === "Center"
                      ? (a + c - o.w) / 2
                      : o.x,
              y:
                axis === "Top"
                  ? b
                  : axis === "Bottom"
                    ? d - o.h
                    : axis === "Middle"
                      ? (b + d - o.h) / 2
                      : o.y,
            }
          : o,
      ),
    });
  }
  function group(ungroup = selected.some((o) => o.gid)) {
    const items = selected.filter((o) => o.t !== "frame");
    if (ungroup) {
      const keys = new Set(
        items.filter((o) => o.gid).map((o) => `${o.fid || ""}:${o.gid}`),
      );
      change({
        ...doc,
        elements: doc.elements.map((o) =>
          o.gid && keys.has(`${o.fid || ""}:${o.gid}`)
            ? { ...o, gid: undefined }
            : o,
        ),
      });
      return;
    }
    const scopes = new Map<string, string>();
    const counts = new Map<string, number>();
    for (const o of items)
      counts.set(o.fid || "", (counts.get(o.fid || "") || 0) + 1);
    for (const [parent, count] of counts)
      if (count > 1) scopes.set(parent, uid());
    if (!scopes.size) {
      notify("Select at least two layers in the same frame to group them.");
      return;
    }
    const ids = new Set(items.map((o) => o.id));
    change({
      ...doc,
      elements: doc.elements.map((o) =>
        ids.has(o.id) && scopes.has(o.fid || "")
          ? { ...o, gid: scopes.get(o.fid || "") }
          : o,
      ),
    });
  }
  function preset(kind: "template" | "object", name: string): Preset {
    if (kind === "template" && !frame) throw new Error("Select a frame first.");
    const objects =
      kind === "template"
        ? doc.elements.filter((o) => o.fid === frame.id)
        : selected.filter((o) => o.t !== "frame");
    if (!objects.length) throw new Error("Select elements first.");
    return {
      name,
      identifier: slugify(name),
      kind,
      ...(kind === "template"
        ? {
            W: frame.w,
            H: frame.h,
            scene: frame.scene ? copy(frame.scene) : undefined,
          }
        : {}),
      objects: objects.map((o) => ({
        ...copy(o),
        x: o.x - (frame?.x || 0),
        y: o.y - (frame?.y || 0),
        fid: undefined,
        gid: undefined,
      })),
    };
  }
  return {
    doc,
    committed,
    getDocument: () => current.current,
    scene,
    current,
    change,
    commit,
    selection,
    select,
    selected,
    active,
    frame,
    patch,
    setIdentifier,
    undo,
    redo,
    remove,
    paste,
    add,
    addFrame,
    duplicateFrame,
    template,
    order,
    drop,
    moveToFrame,
    align,
    group,
    preset,
    expanded,
    copySelection: () => {
      clipboard.current = expanded().map((o) => ({ ...o }));
    },
    duplicate: () => paste(expanded()),
    notice,
    notify,
    storageError,
    canUndo: cursor.current > 0,
    canRedo: cursor.current < history.current.length - 1,
  };
}
export type Editor = ReturnType<typeof useEditor>;
