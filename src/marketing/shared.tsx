import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import { Dialog as DialogRoot, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Icon, type IconName } from "../components/ui/icon";
import { platforms } from "./store";
import { brandImageSource } from "../lib/brand";

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
export function PlatformIcon({ id, size = 17 }: { id: string; size?: number }) {
  const p = platforms.find((p) => p.id === id);
  const source = p && brandImageSource(`social-${p.id}`);
  return p && source ? (
    <span className={`platform-icon platform-${p.id}`} aria-hidden="true">
      <span
        className="ui-icon"
        style={{
          width: size,
          height: size,
          backgroundColor: "currentColor",
          mask: `url("${source}") center / contain no-repeat`,
          WebkitMask: `url("${source}") center / contain no-repeat`,
        }}
      />
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
  return (
    <DialogRoot open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="marketing-dialog" {...(!description ? { "aria-describedby": undefined } : {})}>
        <section>
          <div className="marketing-dialog-head">
            <DialogTitle asChild><h2>{title}</h2></DialogTitle>
            <Button type="button" aria-label="Close dialog" onClick={onClose}>
              <Icon name="close" />
            </Button>
          </div>
          {description && <DialogDescription asChild><p className="dialog-description">{description}</p></DialogDescription>}
          {children}
        </section>
      </DialogContent>
    </DialogRoot>
  );
}
