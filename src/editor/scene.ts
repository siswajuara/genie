import type { Element } from "./model";
export type Point = { x: number; y: number };
export type Bounds = Point & { w: number; h: number };
export type LayerNode = {
  id: string;
  element?: Element;
  children: LayerNode[];
  group?: string;
  parent?: string;
};
export const nodeElements = (node: LayerNode): Element[] =>
  node.element
    ? [node.element, ...node.children.flatMap(nodeElements)]
    : node.children.flatMap(nodeElements);
function groupSiblings(siblings: Element[], parent?: string): LayerNode[] {
  const groups = new Map<string, Element[]>();
  for (const element of siblings)
    if (element.gid && element.t !== "frame") {
      const members = groups.get(element.gid) || [];
      members.push(element);
      groups.set(element.gid, members);
    }
  const seen = new Set<string>(),
    nodes: LayerNode[] = [];
  for (let i = siblings.length - 1; i >= 0; i--) {
    const element = siblings[i];
    if (element.gid && element.t !== "frame") {
      if (seen.has(element.gid)) continue;
      seen.add(element.gid);
      nodes.push({
        id: `group:${parent || "canvas"}:${element.gid}`,
        group: element.gid,
        parent,
        children: groups.get(element.gid)!.map((o) => ({
          id: o.id,
          element: o,
          children: [],
          parent: element.gid,
        })),
      });
    } else nodes.push({ id: element.id, element, children: [], parent });
  }
  return nodes.reverse();
}
export function buildScene(elements: Element[]) {
  const byId = new Map(elements.map((o) => [o.id, o]));
  const children = new Map<string, Element[]>(),
    roots: Element[] = [];
  for (const o of elements) {
    if (o.t !== "frame" && o.fid && byId.get(o.fid)?.t === "frame") {
      const list = children.get(o.fid) || [];
      list.push(o);
      children.set(o.fid, list);
    } else roots.push(o);
  }
  const tree = groupSiblings(roots);
  for (const node of tree)
    if (node.element?.t === "frame")
      node.children = groupSiblings(children.get(node.id) || [], node.id);
  const paint = tree.flatMap(nodeElements);
  const frameChildren = new Map(
    tree
      .filter((n) => n.element?.t === "frame")
      .map((n) => [n.id, n.children.flatMap(nodeElements)]),
  );
  const isHidden = (o: Element) =>
    !!(o.hide || (o.fid && byId.get(o.fid)?.hide));
  const isLocked = (o: Element) =>
    !!(o.lock || (o.fid && byId.get(o.fid)?.lock));
  return {
    byId,
    tree,
    paint,
    frameChildren,
    frames: tree.filter((n) => n.element?.t === "frame").map((n) => n.element!),
    isHidden,
    isLocked,
  };
}
function moveSiblings(
  nodes: LayerNode[],
  selected: Set<string>,
  direction: number,
  end: boolean,
): LayerNode[] {
  const movable = (n: LayerNode) =>
    n.element
      ? selected.has(n.id)
      : n.children.length > 0 && n.children.every((c) => selected.has(c.id));
  const next = nodes.map((n) =>
    movable(n)
      ? n
      : { ...n, children: moveSiblings(n.children, selected, direction, end) },
  );
  if (end) {
    const chosen = next.filter(movable),
      rest = next.filter((n) => !movable(n));
    return direction > 0 ? [...rest, ...chosen] : [...chosen, ...rest];
  }
  if (direction > 0) {
    for (let i = next.length - 2; i >= 0; i--)
      if (movable(next[i]) && !movable(next[i + 1]))
        [next[i], next[i + 1]] = [next[i + 1], next[i]];
  } else
    for (let i = 1; i < next.length; i++)
      if (movable(next[i]) && !movable(next[i - 1]))
        [next[i], next[i - 1]] = [next[i - 1], next[i]];
  return next;
}
export function orderLayers(
  elements: Element[],
  ids: string[],
  direction: number,
  end = false,
) {
  return moveSiblings(
    buildScene(elements).tree,
    new Set(ids),
    direction,
    end,
  ).flatMap(nodeElements);
}
export function dropLayer(
  elements: Element[],
  sourceIds: string[],
  targetId: string,
) {
  const selected = new Set(sourceIds);
  let changed = false;
  const visit = (nodes: LayerNode[]): LayerNode[] => {
    const source = nodes.filter((n) =>
      n.element
        ? selected.has(n.id)
        : n.children.every((c) => selected.has(c.id)),
    );
    const target = nodes.find((n) => n.id === targetId);
    if (target && source.length && !source.includes(target)) {
      changed = true;
      const rest = nodes.filter((n) => !source.includes(n));
      // The visual tree runs top-to-bottom; dropping on a row places the layer immediately above it.
      rest.splice(rest.indexOf(target) + 1, 0, ...source);
      return rest;
    }
    return nodes.map((n) => ({ ...n, children: visit(n.children) }));
  };
  const next = visit(buildScene(elements).tree);
  return changed ? next.flatMap(nodeElements) : elements;
}
export function bounds(o: Element): Bounds {
  const angle = ((o.rot || 0) * Math.PI) / 180;
  const w = Math.abs(o.w * Math.cos(angle)) + Math.abs(o.h * Math.sin(angle));
  const h = Math.abs(o.w * Math.sin(angle)) + Math.abs(o.h * Math.cos(angle));
  const pad = o.t === "line" ? Math.abs(o.bend || 0) + (o.lw || 0) : 0;
  return {
    x: o.x + o.w / 2 - w / 2 - pad,
    y: o.y + o.h / 2 - h / 2 - pad,
    w: w + pad * 2,
    h: h + pad * 2,
  };
}
export const intersects = (a: Bounds, b: Bounds) =>
  a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
function localPoint(p: Point, o: Element): Point {
  const angle = (-(o.rot || 0) * Math.PI) / 180,
    dx = p.x - o.x - o.w / 2,
    dy = p.y - o.y - o.h / 2;
  return {
    x: o.x + o.w / 2 + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: o.y + o.h / 2 + dx * Math.sin(angle) + dy * Math.cos(angle),
  };
}
function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function containsPoint(o: Element, p: Point, tolerance = 5): boolean {
  const q = localPoint(p, o);
  if (o.t === "line") {
    const length = Math.hypot(o.w, o.h) || 1,
      bend = (o.bend || 0) * 2;
    const control = {
      x: o.x + o.w / 2 - (o.h / length) * bend,
      y: o.y + o.h / 2 + (o.w / length) * bend,
    };
    let previous = { x: o.x, y: o.y };
    for (let i = 1; i <= 20; i++) {
      const t = i / 20,
        s = 1 - t,
        next = {
          x: s * s * o.x + 2 * s * t * control.x + t * t * (o.x + o.w),
          y: s * s * o.y + 2 * s * t * control.y + t * t * (o.y + o.h),
        };
      if (
        segmentDistance(q, previous, next) <=
        Math.max(tolerance, (o.lw || 1) / 2)
      )
        return true;
      previous = next;
    }
    return false;
  }
  if (o.t === "ellipse")
    return (
      ((q.x - o.x - o.w / 2) / (o.w / 2)) ** 2 +
        ((q.y - o.y - o.h / 2) / (o.h / 2)) ** 2 <=
      1
    );
  return (
    q.x >= Math.min(o.x, o.x + o.w) &&
    q.x <= Math.max(o.x, o.x + o.w) &&
    q.y >= Math.min(o.y, o.y + o.h) &&
    q.y <= Math.max(o.y, o.y + o.h)
  );
}
export function hitElements(
  scene: ReturnType<typeof buildScene>,
  p: Point,
  tolerance = 5,
) {
  return scene.paint
    .filter((o) => {
      if (scene.isHidden(o) || scene.isLocked(o)) return false;
      const parent = o.fid ? scene.byId.get(o.fid) : undefined;
      return (
        (!parent || containsPoint(parent, p)) && containsPoint(o, p, tolerance)
      );
    })
    .reverse();
}
export function reparentOnDrop(
  elements: Element[],
  ids: string[],
  moved: boolean,
): Element[] {
  if (!moved) return elements;
  const selected = new Set(ids),
    scene = buildScene(elements);
  const targets = new Map<string, Element | undefined>();
  const groups = new Map<string, Element[]>();
  for (const o of elements) {
    if (!o.gid) continue;
    const key = `${o.fid || ""}:${o.gid}`;
    const members = groups.get(key) || [];
    members.push(o);
    groups.set(key, members);
  }
  for (const [key, members] of groups) {
    if (!members.every((q) => selected.has(q.id))) continue;
    const areas = members.map(bounds),
      left = Math.min(...areas.map((a) => a.x)),
      top = Math.min(...areas.map((a) => a.y));
    const center = {
      x: (left + Math.max(...areas.map((a) => a.x + a.w))) / 2,
      y: (top + Math.max(...areas.map((a) => a.y + a.h))) / 2,
    };
    targets.set(
      key,
      [...scene.frames]
        .reverse()
        .find((f) => !f.hide && !f.lock && containsPoint(f, center)),
    );
  }
  return elements.map((o) => {
    if (
      o.t === "frame" ||
      !selected.has(o.id) ||
      (o.fid && selected.has(o.fid))
    )
      return o;
    const center = { x: o.x + o.w / 2, y: o.y + o.h / 2 };
    const groupKey = o.gid ? `${o.fid || ""}:${o.gid}` : "";
    const wholeGroup = targets.has(groupKey);
    const target = wholeGroup
      ? targets.get(groupKey)
      : [...scene.frames]
          .reverse()
          .find((f) => !f.hide && !f.lock && containsPoint(f, center));
    // Clipping outside the current frame is allowed. Only a deliberate drop into another frame reparents a child.
    return target && target.id !== o.fid
      ? { ...o, fid: target.id, gid: wholeGroup ? o.gid : undefined }
      : o;
  });
}
