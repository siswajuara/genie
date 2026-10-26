import { localStore } from "../lib/localStore";
import { useEffect, useState } from "react";
import type { IconName } from "../components/ui/Icon";
import type { StoryDraft } from "../story/storyPipeline";

export const platforms: {
  id: string;
  name: string;
  icon: IconName;
  color: string;
}[] = [
  { id: "instagram", name: "Instagram", icon: "instagram", color: "#a63175" },
  { id: "facebook", name: "Facebook", icon: "facebook", color: "#2166ce" },
  { id: "tiktok", name: "TikTok", icon: "tiktok", color: "#292938" },
  { id: "linkedin", name: "LinkedIn", icon: "linkedin", color: "#0a66a2" },
  { id: "youtube", name: "YouTube", icon: "youtube", color: "#c42b30" },
  { id: "x", name: "X", icon: "x", color: "#424252" },
  { id: "threads", name: "Threads", icon: "threads", color: "#424252" },
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
  story?: StoryDraft;
  id: string;
  projectId: string;
  title: string;
  caption: string;
  media: Media[];
  platforms: string[];
  accountKeys?: string[];
  submissionId?: string;
  delivery?: {
    provider: "buffer" | "zernio";
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
export type BrandSettings = {
  name: string;
  description: string;
  website: string;
  timezone: string;
  weekStart: string;
  theme: string;
};
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
export const initialSettings: BrandSettings = {
  name: "Siswa Juara",
  description: "",
  website: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  weekStart: "monday",
  theme: localStore.getItem("genie.theme") || "light",
};
