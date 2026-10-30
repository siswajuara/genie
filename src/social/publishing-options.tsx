import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "../components/ui/select";
import { useSocial, type Account } from "./client";

type Values = Record<string, string | boolean>;
export function AccountPublishingOptions({ account, values, onChange }: { account: Account; values: Values; onChange: (values: Values) => void }) {
  const social = useSocial(), [privacy, setPrivacy] = useState<string[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const set = (key: string, value: string | boolean) => onChange({ ...values, [key]: value });
  if (!["youtube", "tiktok", "pinterest"].includes(account.platform)) return null;
  return <fieldset className="settings-card"><legend>{account.name} publishing options</legend>
    {account.platform === "youtube" && <>
      <Label className="marketing-field">Video title<Input maxLength={100} value={String(values.title || "")} onChange={(ev) => set("title", ev.target.value)} /></Label>
      <Label className="marketing-field">Audience<SelectField label={`${account.name} audience`} value={typeof values.made_for_kids === "boolean" ? String(values.made_for_kids) : ""} onChange={(value) => set("made_for_kids", value === "true")} options={[{ value: "", label: "Choose an audience" }, { value: "true", label: "Made for kids" }, { value: "false", label: "Not made for kids" }]} /></Label>
      <Label className="marketing-field">Visibility<SelectField label={`${account.name} visibility`} value={String(values.privacy || "public")} onChange={(value) => set("privacy", value)} options={[{ value: "public", label: "Public" }, { value: "unlisted", label: "Unlisted" }, { value: "private", label: "Private" }]} /></Label>
    </>}
    {account.platform === "tiktok" && <>
      <Button disabled={busy} onClick={async () => {
        setBusy(true); setError("");
        try {
          const creator = await social.request<{ privacy_level_options?: string[]; video_public_only?: boolean }>("accountOptions", { accountId: account.id });
          const options = creator.video_public_only ? ["PUBLIC_TO_EVERYONE"] : creator.privacy_level_options || [];
          setPrivacy(options);
          if (!options.length) setError("Tebar returned no available visibility choices. Check the account in Tebar.");
        } catch (err) { setError(String(err)); } finally { setBusy(false); }
      }}>{busy ? "Loading…" : "Load TikTok visibility choices"}</Button>
      <SelectField label={`${account.name} visibility`} value={String(values.privacy_level || "")} onChange={(value) => set("privacy_level", value)} options={[{ value: "", label: "Choose visibility" }, ...[...new Set([...privacy, ...(values.privacy_level ? [String(values.privacy_level)] : [])])].map((value) => ({ value, label: value.replaceAll("_", " ").toLowerCase() }))]} />
      <p>Choose visibility explicitly. Comments, Duet, and Stitch use the account defaults reported by Tebar.</p>
    </>}
    {account.platform === "pinterest" && <Label className="marketing-field">Pinterest board ID or name<Input value={String(values.board_id || "")} onChange={(ev) => set("board_id", ev.target.value)} placeholder="Board to publish to" /></Label>}
    {error && <p className="error" role="alert">{error}</p>}
  </fieldset>;
}
