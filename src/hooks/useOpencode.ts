import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Agent,
  Message,
  Model,
  Part,
  Permission,
  Session,
} from "@opencode-ai/sdk/client";
import {
  DEFAULT_URL,
  contextUsed,
  data,
  errMsg,
  freeZenModels,
  makeClient,
  modelKey,
  usageByModel,
} from "../lib/opencode";
import type { Bundle } from "../lib/opencode";

export type Conn = "connecting" | "online" | "offline";

const LS = { url: "oc.url", model: "oc.model", agent: "oc.agent" };
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
};

// Housekeeping agents the server runs itself; not meant to be chatted with.
const INTERNAL_AGENTS = new Set(["compaction", "title", "summary"]);

const byId = (a: Bundle, b: Bundle) => (a.info.id < b.info.id ? -1 : 1);
function upsertInfo(prev: Bundle[], info: Message): Bundle[] {
  const i = prev.findIndex((b) => b.info.id === info.id);
  if (i < 0) return [...prev, { info, parts: [] }].sort(byId);
  const next = [...prev];
  next[i] = { ...next[i], info };
  return next;
}
function upsertPart(prev: Bundle[], part: Part): Bundle[] {
  const i = prev.findIndex((b) => b.info.id === part.messageID);
  if (i < 0) return prev;
  const parts = [...prev[i].parts];
  const j = parts.findIndex((p) => p.id === part.id);
  if (j >= 0) parts[j] = part;
  else parts.push(part);
  const next = [...prev];
  next[i] = { ...next[i], parts };
  return next;
}
const upsertSession = (prev: Session[], s: Session) =>
  [s, ...prev.filter((x) => x.id !== s.id)].sort(
    (a, b) => b.time.updated - a.time.updated,
  );

export function useOpencode() {
  const [baseUrl, setBaseUrlState] = useState(read(LS.url) ?? DEFAULT_URL);
  const client = useMemo(() => makeClient(baseUrl), [baseUrl]);
  const [conn, setConn] = useState<Conn>("connecting");
  const [connError, setConnError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [directory, setDirectory] = useState("");
  const [models, setModels] = useState<Model[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [catalogReady, setCatalogReady] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Bundle[]>([]);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modelSel, setModelSel] = useState(read(LS.model));
  const [agentSel, setAgentSel] = useState(read(LS.agent));
  const activeRef = useRef<string | null>(null);
  const skipLoad = useRef(false);

  const setBaseUrl = (u: string) => {
    write(LS.url, u);
    setBaseUrlState(u);
  };
  const retry = () => setTick((t) => t + 1);

  // 1. Reach the server; keep retrying while it is down.
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const attempt = async () => {
      try {
        const p = data(await client.path.get());
        if (cancelled) return;
        setDirectory(p.directory);
        setConnError(null);
        setConn("online");
      } catch (e) {
        if (cancelled) return;
        setConn("offline");
        setConnError(errMsg(e));
        timer = window.setTimeout(attempt, 3000);
      }
    };
    setConn("connecting");
    void attempt();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [client, tick]);

  // 2. Load providers, agents and sessions once online.
  useEffect(() => {
    if (conn !== "online") return;
    let cancelled = false;
    (async () => {
      try {
        const [prov, ags, sess] = await Promise.all([
          client.config.providers(),
          client.app.agents(),
          client.session.list(),
        ]);
        if (cancelled) return;
        setModels(freeZenModels(data(prov).providers));
        setAgents(
          data(ags).filter(
            (a) => a.mode !== "subagent" && !INTERNAL_AGENTS.has(a.name),
          ),
        );
        setSessions(
          data(sess)
            .filter((s) => !s.parentID)
            .sort((a, b) => b.time.updated - a.time.updated),
        );
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      } finally {
        if (!cancelled) setCatalogReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, conn]);

  const loadMessages = useCallback(
    async (id: string) => {
      const res = data(await client.session.messages({ path: { id } }));
      if (activeRef.current === id)
        setMessages(res.map((m) => ({ info: m.info, parts: m.parts })));
    },
    [client],
  );

  // 3. Load history whenever the active session changes.
  useEffect(() => {
    activeRef.current = activeId;
    if (skipLoad.current) {
      skipLoad.current = false;
      return;
    }
    setMessages([]);
    if (!activeId || conn !== "online") return;
    loadMessages(activeId).catch((e) => setError(errMsg(e)));
  }, [activeId, conn, loadMessages]);

  // 4. Live updates over server-sent events.
  useEffect(() => {
    if (conn !== "online") return;
    const ac = new AbortController();
    const sid = () => activeRef.current;
    (async () => {
      try {
        const sub = await client.event.subscribe({ signal: ac.signal });
        for await (const ev of sub.stream) {
          switch (ev.type) {
            case "message.updated":
              if (ev.properties.info.sessionID === sid())
                setMessages((p) => upsertInfo(p, ev.properties.info));
              break;
            case "message.part.updated":
              if (ev.properties.part.sessionID === sid())
                setMessages((p) => upsertPart(p, ev.properties.part));
              break;
            case "message.part.removed": {
              const { sessionID, messageID, partID } = ev.properties;
              if (sessionID === sid())
                setMessages((p) =>
                  p.map((b) =>
                    b.info.id === messageID
                      ? { ...b, parts: b.parts.filter((x) => x.id !== partID) }
                      : b,
                  ),
                );
              break;
            }
            case "message.removed": {
              const { sessionID, messageID } = ev.properties;
              if (sessionID === sid())
                setMessages((p) => p.filter((b) => b.info.id !== messageID));
              break;
            }
            case "session.status": {
              const { sessionID, status } = ev.properties;
              setBusy((b) => ({ ...b, [sessionID]: status.type !== "idle" }));
              break;
            }
            case "session.idle": {
              const { sessionID } = ev.properties;
              setBusy((b) => ({ ...b, [sessionID]: false }));
              if (sessionID === sid())
                loadMessages(sessionID).catch(() => undefined);
              break;
            }
            case "session.created":
            case "session.updated":
              if (!ev.properties.info.parentID)
                setSessions((p) => upsertSession(p, ev.properties.info));
              break;
            case "session.deleted":
              setSessions((p) =>
                p.filter((s) => s.id !== ev.properties.info.id),
              );
              break;
            case "session.error": {
              const { sessionID, error: e } = ev.properties;
              if (!sessionID || sessionID === sid())
                setError(e ? errMsg(e) : "The session reported an error");
              break;
            }
            case "permission.updated":
              setPermissions((p) => [
                ...p.filter((x) => x.id !== ev.properties.id),
                ev.properties,
              ]);
              break;
            case "permission.replied":
              setPermissions((p) =>
                p.filter((x) => x.id !== ev.properties.permissionID),
              );
              break;
          }
        }
        if (!ac.signal.aborted) retry();
      } catch {
        if (!ac.signal.aborted) retry();
      }
    })();
    return () => ac.abort();
  }, [client, conn, loadMessages]);

  const agentList = agents;
  const model =
    models.find((m) => modelKey(m.providerID, m.id) === modelSel) ??
    models[0] ??
    null;
  const agent =
    agentList.find((a) => a.name === agentSel) ??
    agentList.find((a) => a.name === "build") ??
    agentList[0] ??
    null;

  const pickModel = (m: Model) => {
    const k = modelKey(m.providerID, m.id);
    write(LS.model, k);
    setModelSel(k);
  };
  const pickAgent = (name: string) => {
    write(LS.agent, name);
    setAgentSel(name);
  };

  const send = useCallback(
    async (text: string) => {
      if (!model) return;
      setError(null);
      let id = activeRef.current;
      try {
        if (!id) {
          const s = data(await client.session.create({ body: {} }));
          skipLoad.current = true;
          activeRef.current = s.id;
          setActiveId(s.id);
          setSessions((p) => upsertSession(p, s));
          id = s.id;
        }
        setBusy((b) => ({ ...b, [id!]: true }));
        await client.session.promptAsync({
          path: { id },
          body: {
            model: { providerID: model.providerID, modelID: model.id },
            agent: agent?.name,
            parts: [{ type: "text", text }],
          },
        });
      } catch (e) {
        if (id) setBusy((b) => ({ ...b, [id!]: false }));
        setError(errMsg(e));
      }
    },
    [client, model, agent],
  );

  const stop = useCallback(async () => {
    const id = activeRef.current;
    if (!id) return;
    try {
      await client.session.abort({ path: { id } });
    } catch (e) {
      setError(errMsg(e));
    }
  }, [client]);

  const answerPermission = useCallback(
    async (p: Permission, response: "once" | "always" | "reject") => {
      try {
        await client.postSessionIdPermissionsPermissionId({
          path: { id: p.sessionID, permissionID: p.id },
          body: { response },
        });
        setPermissions((x) => x.filter((y) => y.id !== p.id));
      } catch (e) {
        setError(errMsg(e));
      }
    },
    [client],
  );

  const usage = useMemo(() => usageByModel(messages), [messages]);
  const context = useMemo(() => contextUsed(messages), [messages]);
  const active = sessions.find((s) => s.id === activeId) ?? null;

  return {
    baseUrl,
    setBaseUrl,
    conn,
    connError,
    retry,
    directory,
    models,
    agents: agentList,
    catalogReady,
    model,
    agent,
    pickModel,
    pickAgent,
    sessions,
    active,
    activeId,
    selectSession: setActiveId,
    newChat: () => setActiveId(null),
    messages,
    busy: activeId ? !!busy[activeId] : false,
    permissions: permissions.filter((p) => p.sessionID === activeId),
    error,
    dismissError: () => setError(null),
    send,
    stop,
    answerPermission,
    usage,
    context,
  };
}
export type Oc = ReturnType<typeof useOpencode>;
