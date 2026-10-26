import { Switch } from "./switch";

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <span className="toggle-field">
      <span className="toggle-text">
        <span>{label}</span>
        {description && <small>{description}</small>}
      </span>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        aria-label={label}
        disabled={disabled}
      />
    </span>
  );
}
