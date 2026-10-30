import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
export type Provider = "tebar";
export type Account = {
  id: string;
  key: string;
  provider: Provider;
  platform: string;
  name: string;
  username: string;
  active: boolean;
  profileId?: string;
};
export type Issue = { provider: Provider; message: string };
export type Config = {
  storage: "file";
  opencode?: {
    url: string;
    model: string;
    tokenConfigured: boolean;
    mode: "url" | "local";
  };
  elevenlabs: { configured: boolean; accounts: AudioAccount[] };
  tebar: { configured: boolean; profileId: string };
};
export type AccountsResult = {
  accounts: Account[];
  profiles: { id: string; name: string; is_default?: boolean }[];
  ownerKey: boolean;
  scopes?: string[];
  issues: Issue[];
};
export type AudioAccount = {
  id: string;
  name: string;
  configured: boolean;
  enabled: boolean;
};
type SaveValues = {
  key?: string;
  url?: string;
  model?: string;
  token?: string;
  removeToken?: boolean;
  profileId?: string;
  removeKey?: boolean;
  accountId?: string;
  name?: string;
  enabled?: boolean;
};
export type PublishResult = {
  provider: string;
  accountKey: string;
  accountName: string;
  success: boolean;
  id?: string;
  status?: string;
  error?: string;
  uncertain?: boolean;
};
export async function socialRequest<T>(
  action: string,
  payload: unknown = {},
): Promise<T> {
  return transport<T>("request", { action, payload });
}
async function transport<T>(endpoint: string, body: unknown): Promise<T> {
  if (isTauri())
    return invoke<T>(
      `social_${endpoint}`,
      endpoint === "settings"
        ? { payload: body }
        : (body as Record<string, unknown>),
    );
  const response = await fetch(`/api/genie-social/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw Error(
      "Social connections require the desktop app or the local development server.",
    );
  const result = await response.json();
  if (!response.ok || result.error)
    throw Error(result.error || "The social request failed.");
  return result.data as T;
}
type SocialContextValue = {
  config: Config;
  accounts: Account[];
  profiles: AccountsResult["profiles"];
  ownerKey: boolean;
  issues: Issue[];
  busy: boolean;
  error: string;
  revision: number;
  refresh: () => Promise<void>;
  save: (
    provider: Provider | "elevenlabs" | "opencode",
    values: SaveValues,
  ) => Promise<void>;
  test: (provider: Provider) => Promise<AccountsResult>;
  request: typeof socialRequest;
};
const Context = createContext<SocialContextValue | null>(null);
const initial: Config = {
  storage: "file",
  opencode: { url: "", model: "", tokenConfigured: false, mode: "local" },
  elevenlabs: { configured: false, accounts: [] },
  tebar: { configured: false, profileId: "" },
};
export function SocialProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState(initial),
    [data, setData] = useState<AccountsResult>({
      accounts: [],
      ownerKey: false,
      profiles: [],
      issues: [],
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const refresh = useCallback(async (force = true) => {
    setBusy(true);
    setError("");
    try {
      setConfig(await transport<Config>("settings", {}));
      setData(
        await socialRequest<AccountsResult>("accounts", { refresh: force }),
      );
      setRevision((n) => n + 1);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void refresh(false);
  }, [refresh]);
  const save = useCallback(
    async (
      provider: Provider | "elevenlabs" | "opencode",
      values: SaveValues,
    ) => {
      setConfig(await transport<Config>("settings", { provider, ...values }));
      setData((old) => ({
        ...old,
        accounts: old.accounts.filter((a) => a.provider !== provider),
        issues: old.issues.filter((i) => i.provider !== provider),
        ...(provider === "tebar" ? { profiles: [], ownerKey: false } : {}),
      }));
      setRevision((n) => n + 1);
    },
    [],
  );
  const test = useCallback(async (provider: Provider) => {
    const result = await socialRequest<AccountsResult>("test", { provider });
    setData((old) => ({
      accounts: [
        ...old.accounts.filter((a) => a.provider !== provider),
        ...result.accounts,
      ],
      profiles: result.profiles,
      ownerKey: result.ownerKey,
      issues: old.issues.filter((i) => i.provider !== provider),
    }));
    setRevision((n) => n + 1);
    return result;
  }, []);
  const value = useMemo(
    () => ({
      config,
      ...data,
      busy,
      error,
      revision,
      refresh,
      save,
      test,
      request: socialRequest,
    }),
    [config, data, busy, error, revision, refresh, save, test],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useSocial() {
  const context = useContext(Context);
  if (!context) throw Error("SocialProvider is missing.");
  return context;
}
export function useSocialResource<T>(
  action: string,
  payload: Record<string, unknown>,
  enabled = true,
) {
  const { revision } = useSocial(),
    key = JSON.stringify(payload);
  const [data, setData] = useState<T>(),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [refreshIndex, setRefreshIndex] = useState(0);
  useEffect(() => {
    let live = true;
    setData(undefined);
    setError("");
    setLoading(false);
    if (!enabled) return;
    setLoading(true);
    void socialRequest<T>(action, JSON.parse(key))
      .then((value) => {
        if (live) setData(value);
      })
      .catch((err) => {
        if (live) setError(String(err));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [action, key, enabled, revision, refreshIndex]);
  return { data, error, loading, refresh: () => setRefreshIndex((n) => n + 1) };
}
