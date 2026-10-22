import { useEffect, useRef, type ReactNode } from "react";
import { Icon, type IconName } from "../components/ui/Icon";
import { platforms } from "./store";

export function PageIntro({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="marketing-page-intro">
      <div>
        <h1 tabIndex={-1}>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: IconName;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="marketing-empty">
      <span className="empty-state-icon">
        <Icon name={icon} size={28} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Segments<T extends string>({
  values,
  value,
  onChange,
  label,
}: {
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="marketing-segments" role="group" aria-label={label}>
      {values.map((item) => (
        <button
          type="button"
          key={item}
          aria-pressed={value === item}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
export function PlatformIcon({ id, size = 17 }: { id: string; size?: number }) {
  const p = platforms.find((p) => p.id === id);
  return p ? (
    <span className={`platform-icon platform-${p.id}`} aria-hidden="true">
      <Icon name={p.icon} size={size} />
    </span>
  ) : null;
}
export function Dialog({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="marketing-dialog"
      aria-labelledby="marketing-dialog-title"
      onCancel={onClose}
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <section>
        <div className="marketing-dialog-head">
          <h2 id="marketing-dialog-title">{title}</h2>
          <button type="button" aria-label="Close dialog" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {description && <p className="dialog-description">{description}</p>}
        {children}
      </section>
    </dialog>
  );
}
