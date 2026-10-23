import { localStore } from "../lib/localStore";
import { useEffect, useState } from "react";
import type { Workspace } from "../editor/projects";
import type { IconName } from "../components/ui/Icon";

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
export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "tool";
  text: string;
};
export type Conversation = {
  key: string;
  scope: string;
  thread?: string;
  messages: ChatMessage[];
  updatedAt: string;
};
export const chatEvent = "genie:chats-updated";
export function readConversations(workspace: Workspace): Conversation[] {
  const records = new Map<string, Conversation>();
  try {
    for (let i = 0; i < localStore.length; i++) {
      const name = localStore.key(i)!;
      if (!name.startsWith("genie.conversation.")) continue;
      try {
        const record = JSON.parse(localStore.getItem(name)!);
        if (
          record.key &&
          typeof record.scope === "string" &&
          Array.isArray(record.messages) &&
          record.messages.length
        )
          records.set(record.key, record);
      } catch {
        /* Ignore a damaged conversation without hiding the others. */
      }
    }
    for (const project of workspace.projects)
      for (const page of project.pages) {
        const scope = `${project.id}-${page.id}`;
        try {
          const record = JSON.parse(
            localStore.getItem(`genie.chat.${scope}`) || "null",
          );
          if (
            record?.key &&
            Array.isArray(record.messages) &&
            record.messages.length &&
            !records.has(record.key)
          )
            records.set(record.key, {
              ...record,
              scope,
              updatedAt: page.canvas.metadata.updatedAt,
            });
        } catch {
          /* Older canvas chat remains available when valid. */
        }
      }
  } catch {
    /* A blocked storage area produces an empty history. */
  }
  return [...records.values()].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}
export function conversationTitle(chat: Conversation) {
  return (
    chat.messages.find((m) => m.role === "user")?.text.slice(0, 90) ||
    "New conversation"
  );
}
export function conversationPage(workspace: Workspace, scope: string) {
  for (const project of workspace.projects) {
    if (project.id === scope)
      return {
        project,
        page:
          project.pages.find(
            (p) => p.id === (project.activePageId || workspace.activePageId),
          ) || project.pages[0],
      };
    for (const page of project.pages)
      if (`${project.id}-${page.id}` === scope) return { project, page };
  }
  return undefined;
}
/** Remove previously stored empty conversations so they stop crowding history. */
export function pruneEmptyConversations() {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStore.length; i++) {
      const name = localStore.key(i)!;
      if (!name.startsWith("genie.conversation.")) continue;
      try {
        const record = JSON.parse(localStore.getItem(name)!);
        if (!record?.messages?.length) doomed.push(name);
      } catch {
        doomed.push(name);
      }
    }
    for (const name of doomed) localStore.removeItem(name);
  } catch {
    /* Storage stays untouched when it cannot be read. */
  }
}
export function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      return JSON.parse(localStore.getItem(key) || "null") ?? initial;
    } catch {
      return initial;
    }
  });
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      localStore.setItem(key, JSON.stringify(value));
      setError("");
    } catch {
      setError(
        "Changes could not be saved on this device. Storage may be full.",
      );
    }
  }, [key, value]);
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
