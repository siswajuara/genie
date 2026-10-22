import { useLayoutEffect, useRef, type CSSProperties } from "react";
import type { Element } from "./model";

// Rich color spans remain visible while editing; only text and supported color tags are serialized.
export function InlineText({
  element: o,
  view,
  onCommit,
}: {
  element: Element;
  view: { x: number; y: number; z: number };
  onCommit: (text: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fill = o.color || "#14226e";
  const style: CSSProperties = {
    left: o.x * view.z + view.x,
    top: o.y * view.z + view.y,
    width: o.w * view.z,
    height: o.h * view.z,
    boxSizing: "border-box",
    fontSize: (o.size || 44) * view.z,
    fontFamily: `"${o.font || "Nunito"}", sans-serif`,
    fontWeight: o.weight || 800,
    color: fill,
    // Canvas paints outline first and fill on top. Mirror that order so a
    // thick white outline cannot swallow the fill while editing.
    WebkitTextFillColor: fill,
    paintOrder: "stroke fill",
    textAlign:
      o.align === "left" ? "left" : o.align === "right" ? "right" : "center",
    lineHeight: o.lh || 1.15,
    letterSpacing: (o.ls || 0) * view.z,
    whiteSpace: "pre",
    overflowWrap: "normal",
    wordBreak: "normal",
    paddingTop:
      Math.max(
        0,
        (o.h -
          (o.text || "").split("\n").length * (o.size || 44) * (o.lh || 1.15)) /
          2,
      ) * view.z,
    opacity: o.op ?? 1,
    transform: `rotate(${o.rot || 0}deg)`,
    WebkitTextStroke: o.tsw
      ? `${o.tsw * view.z}px ${o.tstroke || "#000"}`
      : undefined,
  };
  useLayoutEffect(() => {
    const el = ref.current!;
    el.replaceChildren();
    let color: string | undefined;
    for (const part of (o.text || "").split(
      /(\[c=#[\da-f]{3,8}\]|\[\/c\])/gi,
    )) {
      if (/^\[c=/i.test(part)) {
        color = part.slice(3, -1);
        continue;
      }
      if (part === "[/c]") {
        color = undefined;
        continue;
      }
      if (color) {
        const span = document.createElement("span");
        span.dataset.color = color;
        span.style.color = color;
        span.style.webkitTextFillColor = color;
        span.textContent = part;
        el.append(span);
      } else el.append(document.createTextNode(part));
    }
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }, [o.id]);
  // Browsers insert DIV/P blocks for new lines; serialize them back to \n
  // so multi-line edits round-trip to the canvas model.
  function serializeChildren(parent: Node): string {
    const parts: string[] = [];
    parent.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent || "");
        return;
      }
      if (!(node instanceof HTMLElement)) return;
      if (node.tagName === "BR") {
        parts.push("\n");
        return;
      }
      if (/^(DIV|P|LI|H[1-6]|BLOCKQUOTE)$/.test(node.tagName)) {
        parts.push(serializeChildren(node));
        parts.push("\n");
        return;
      }
      const text = serializeChildren(node);
      parts.push(
        node.dataset.color ? `[c=${node.dataset.color}]${text}[/c]` : text,
      );
    });
    return parts.join("");
  }
  function serializeRoot(root: Node): string {
    // Each block above appends \n; drop the single trailing one that only
    // marks the end of the last block.
    return serializeChildren(root).replace(/\n$/, "");
  }
  return (
    <div
      ref={ref}
      role="textbox"
      aria-label="Edit canvas text"
      aria-multiline="true"
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      className="inline-text"
      style={style}
      onBlur={() => onCommit(serializeRoot(ref.current!))}
      onKeyDown={(ev) => {
        ev.stopPropagation();
        if (ev.key === "Escape") {
          ev.preventDefault();
          ev.currentTarget.blur();
        }
        if (ev.key === "Enter") {
          ev.preventDefault();
          document.execCommand("insertLineBreak");
        }
      }}
      onPaste={(ev) => {
        ev.preventDefault();
        document.execCommand(
          "insertText",
          false,
          ev.clipboardData.getData("text/plain"),
        );
      }}
    />
  );
}
