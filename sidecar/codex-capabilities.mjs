import { spawn } from "node:child_process";
import readline from "node:readline";
import {
  resolveCodexExecutable,
  codexEnvironment,
} from "./codex-executable.mjs";
import { modelCatalog } from "./codex-options.mjs";

export async function codexCapabilities(override) {
  const executable = await resolveCodexExecutable(override);
  const child = spawn(executable, ["app-server", "--listen", "stdio://"], {
    env: codexEnvironment(executable),
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stderr.resume();
  const lines = readline.createInterface({ input: child.stdout });
  const pending = new Map();
  let nextId = 0,
    stopped = false;
  function stop(error) {
    stopped = true;
    for (const item of pending.values()) item.reject(error);
    pending.clear();
  }
  const deadline = setTimeout(() => {
    stop(
      new Error(
        "Codex settings took too long to load. Retry or use the configured default.",
      ),
    );
    child.kill();
  }, 30000);
  child.on("error", () =>
    stop(new Error("Could not start the Codex model catalogue.")),
  );
  child.on("exit", () =>
    stop(new Error("Codex stopped while loading its settings.")),
  );
  child.stdin.on("error", () =>
    stop(new Error("Could not read Codex settings.")),
  );
  lines.on("line", (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    const item = pending.get(message.id);
    if (!item) {
      if (message.method && message.id != null)
        child.stdin.write(
          JSON.stringify({
            id: message.id,
            error: {
              code: -32601,
              message: "This connection only reads settings.",
            },
          }) + "\n",
        );
      return;
    }
    pending.delete(message.id);
    if (message.error)
      item.reject(new Error("Codex could not load " + item.method + "."));
    else item.resolve(message.result);
  });
  async function request(method, params = {}) {
    if (stopped) throw new Error("Codex settings connection is closed.");
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(
          new Error(
            "Codex settings took too long to load. Retry or use the configured default.",
          ),
        );
      }, 12000);
      pending.set(id, {
        method,
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      child.stdin.write(JSON.stringify({ id, method, params }) + "\n");
    });
  }
  try {
    await request("initialize", {
      clientInfo: {
        name: "genie",
        title: "Genie by SiswaJuara",
        version: "0.1.0",
      },
    });
    child.stdin.write(
      JSON.stringify({ method: "initialized", params: {} }) + "\n",
    );
    const warnings = [];
    async function models() {
      const result = [];
      let cursor;
      for (let page = 0; page < 20; page++) {
        const response = await request("model/list", {
          limit: 100,
          includeHidden: false,
          ...(cursor ? { cursor } : {}),
        });
        result.push(...(response.data || []));
        if (!response.nextCursor) return modelCatalog(result);
        cursor = response.nextCursor;
      }
      return modelCatalog(result);
    }
    const [catalog, info] = await Promise.all([
      models().catch((error) => {
        warnings.push(error.message);
        return [];
      }),
      request("account/read", { refreshToken: false }).catch(() => {
        warnings.push("Account status is unavailable.");
        return null;
      }),
    ]);
    const account = info?.account
      ? { type: info.account.type, plan: info.account.planType || null }
      : null;
    let limits = null;
    if (account?.type === "chatgpt") {
      const response = await request("account/rateLimits/read").catch(
        () => null,
      );
      const source = response?.rateLimits;
      if (source)
        limits = {
          primary: source.primary || null,
          secondary: source.secondary || null,
        };
    }
    return {
      models: catalog,
      account,
      requiresOpenaiAuth: info?.requiresOpenaiAuth ?? null,
      limits,
      warnings,
    };
  } finally {
    clearTimeout(deadline);
    stop(new Error("Codex settings connection closed."));
    lines.close();
    child.stdin.end();
    child.kill();
  }
}
