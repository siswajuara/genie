import { useEffect, useRef, useState } from "react";
import type { Model } from "@opencode-ai/sdk/client";
import { modelKey } from "../lib/opencode";
import type { Usage } from "../lib/opencode";
import { ModelCard } from "./ModelCard";

type Props = {
  models: Model[];
  selected: Model | null;
  onSelect: (m: Model) => void;
  usage: Record<string, Usage>;
  context: { tokens: number; key: string } | null;
};

export function ModelPicker({ models, selected, onSelect, usage, context }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [chipHover, setChipHover] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const opts = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    menu.current?.focus();
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const openMenu = () => {
    setActive(Math.max(0, models.findIndex((m) => m === selected)));
    setChipHover(false);
    setOpen(true);
  };
  const choose = (m: Model) => { onSelect(m); setOpen(false); chip.current?.focus(); };

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); chip.current?.focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % models.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + models.length) % models.length); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(models.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (models[active]) choose(models[active]); }
  };

  const disabled = models.length === 0;
  const cardModel = open ? models[active] : chipHover ? selected : null;
  let anchor: DOMRect | null = null;
  if (cardModel && open && menu.current) {
    const m = menu.current.getBoundingClientRect();
    const o = opts.current[active]?.getBoundingClientRect();
    anchor = new DOMRect(m.left, o?.top ?? m.top, m.width, o?.height ?? 0);
  } else if (cardModel && chip.current) {
    anchor = chip.current.getBoundingClientRect();
  }
  const key = cardModel ? modelKey(cardModel.providerID, cardModel.id) : "";

  return (
    <div className="mpicker" ref={wrap}>
      <button
        ref={chip}
        type="button"
        className="chip"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-describedby={cardModel && !open ? "model-card" : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(e) => { if (!open && e.key === "ArrowUp") { e.preventDefault(); openMenu(); } }}
        onMouseEnter={() => setChipHover(true)}
        onMouseLeave={() => setChipHover(false)}
        onFocus={() => setChipHover(true)}
        onBlur={() => setChipHover(false)}
      >
        <span className="chip-k">Model</span>
        <span className="chip-v">{selected?.name ?? "None available"}</span>
      </button>

      {open && (
        <div
          ref={menu}
          className="menu"
          role="listbox"
          tabIndex={-1}
          aria-label="Free Zen models"
          aria-activedescendant={`mopt-${active}`}
          onKeyDown={onMenuKey}
        >
          <p className="menu-head">Free Zen models · {models.length}</p>
          {models.map((m, i) => (
            <button
              key={modelKey(m.providerID, m.id)}
              id={`mopt-${i}`}
              ref={(el) => { opts.current[i] = el; }}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={m === selected}
              aria-describedby={i === active ? "model-card" : undefined}
              className={`opt${i === active ? " is-active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(m)}
            >
              <span>{m.name}</span>
              <span className="muted">{m === selected ? "Selected" : `${Math.round(m.limit.context / 1000)}K`}</span>
            </button>
          ))}
        </div>
      )}

      {cardModel && anchor && (
        <ModelCard
          id="model-card"
          model={cardModel}
          usage={usage[key]}
          contextTokens={context?.key === key ? context.tokens : undefined}
          anchor={anchor}
          placement={open ? "right" : "above"}
        />
      )}
    </div>
  );
}
