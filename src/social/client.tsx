import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isTauri } from "@tauri-apps/api/core";
import {websiteRequest} from './connection';
import { openUrl } from "@tauri-apps/plugin-opener";
export type Provider = "buffer" | "zernio";
export type Account = {
  id: string;
  key: string;
  provider: Provider;
  platform: string;
  name: string;
  username: string;
  active: boolean;
  organizationId?: string;
  profileId?: string;
};
export type Issue = { provider: Provider; message: string };
export type Config = {
  storage: "server";
  buffer: { configured: boolean; organizationId: string };
  zernio: { configured: boolean; profileId: string };
};
export type AccountsResult = {
  accounts: Account[];
  organizations: { id: string; name: string }[];
  profiles: { _id?: string; id?: string; name: string }[];
  issues: Issue[];
};
export type PublishResult = {
  provider: Provider;
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
  return websiteRequest<T>(endpoint,body);
}
export async function openSocialUrl(url: string) {
  if (!url.startsWith("https://"))
    throw Error("The provider returned an invalid connection URL.");
  if (isTauri()) await openUrl(url);
  else {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (opened) opened.opener = null;
  }
}
type SocialContextValue = {
  config: Config;
  accounts: Account[];
  organizations: AccountsResult["organizations"];
  profiles: AccountsResult["profiles"];
  issues: Issue[];
  busy: boolean;
  error: string;
  revision: number;
  refresh: () => Promise<void>;
  save: (
    provider: Provider,
    values: {
      key?: string;
      organizationId?: string;
      profileId?: string;
      removeKey?: boolean;
    },
  ) => Promise<void>;
  test: (provider: Provider) => Promise<AccountsResult>;
  request: typeof socialRequest;
};
const Context = createContext<SocialContextValue | null>(null);
const initial: Config = {
  storage: "server",
  buffer: { configured: false, organizationId: "" },
  zernio: { configured: false, profileId: "" },
};
export function SocialProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState(initial),
    [data, setData] = useState<AccountsResult>({
      accounts: [],
      organizations: [],
      profiles: [],
      issues: [],
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      setConfig(await transport<Config>("settings", {}));
      setData(await socialRequest<AccountsResult>("accounts"));
      setRevision((n) => n + 1);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const save = useCallback(
    async (
      provider: Provider,
      values: {
        key?: string;
        organizationId?: string;
        profileId?: string;
        removeKey?: boolean;
      },
    ) => {
      setConfig(await transport<Config>("settings", { provider, ...values }));
      setData((old) => ({
        ...old,
        accounts: old.accounts.filter((a) => a.provider !== provider),
        issues: old.issues.filter((i) => i.provider !== provider),
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
      organizations:
        provider === "buffer" ? result.organizations : old.organizations,
      profiles: provider === "zernio" ? result.profiles : old.profiles,
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
