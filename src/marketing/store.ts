import { localStore } from "../lib/local-store";
import { useEffect, useState } from "react";

export const platforms: {
  id: string;
  name: string;
  color: string;
}[] = [
  { id: "instagram", name: "Instagram", color: "#a63175" },
  { id: "facebook", name: "Facebook", color: "#2166ce" },
  { id: "tiktok", name: "TikTok", color: "#292938" },
  { id: "linkedin", name: "LinkedIn", color: "#0a66a2" },
  { id: "youtube", name: "YouTube", color: "#c42b30" },
  { id: "x", name: "X", color: "#424252" },
  { id: "threads", name: "Threads", color: "#424252" },
  { id: "telegram", name: "Telegram", color: "#229ed9" },
  { id: "discord", name: "Discord", color: "#5865f2" },
  { id: "pinterest", name: "Pinterest", color: "#bd081c" },
];
export type Media = {
  id: string;
  name: string;
  kind: "frame" | "image" | "video";
  src?: string;
  projectId?: string;
  pageId?: string;
  frameId?: string;
  alt?: string;
};
export type Post = {
  id: string;
  projectId: string;
  title: string;
  caption: string;
  media: Media[];
  platforms: string[];
  accountKeys?: string[];
  accountOptions?: Record<string, Record<string, string | boolean>>;
  submissionId?: string;
  delivery?: {
    // Historical receipts remain readable after changing integrations.
    provider: string;
    accountKey: string;
    accountName: string;
    success: boolean;
    id?: string;
    status?: string;
    error?: string;
    uncertain?: boolean;
  }[];
  timing: "now" | "schedule";
  date?: string;
  time: string;
  status: "draft" | "planned";
  updatedAt: string;
};
export type WorkspacePreferences = { theme: string };
export function useLocalState<T>(
  key: string,
  initial: T,
  persistInEffect = true,
) {
  const [value, setValue] = useState<T>(() => {
    try {
      return JSON.parse(localStore.getItem(key) || "null") ?? initial;
    } catch {
      return initial;
    }
  });
  const [error, setError] = useState("");
  useEffect(() => {
    if (!persistInEffect) return;
    try {
      localStore.setItem(key, JSON.stringify(value));
      setError("");
    } catch {
      setError(
        "Changes could not be saved on this device. Storage may be full.",
      );
    }
  }, [key, value, persistInEffect]);
  return [value, setValue, error] as const;
}
export function emptyPost(projectId: string): Post {
  return {
    id: crypto.randomUUID(),
    projectId,
    title: "",
    caption: "",
    media: [],
    platforms: [],
    timing: "schedule",
    time: "09:00",
    status: "draft",
    updatedAt: new Date().toISOString(),
  };
}
export const initialPreferences: WorkspacePreferences = {
  theme: localStore.getItem("genie.theme") || "light",
};
