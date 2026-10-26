export function elevenLabsAccounts(config) {
  const provider = config.elevenlabs || {};
  const accounts = provider.accounts || [];
  if (!Array.isArray(accounts))
    throw Error("Invalid ElevenLabs account list in config.json.");
  if (provider.key && !accounts.some((account) => account.key === provider.key))
    return [
      {
        id: "legacy",
        name: "ElevenLabs account",
        key: provider.key,
        enabled: true,
      },
      ...accounts,
    ];
  return accounts;
}

export function publicElevenLabs(config) {
  const accounts = elevenLabsAccounts(config).map(
    ({ id, name, key, enabled }) => ({
      id,
      name,
      configured: !!key,
      enabled: enabled !== false,
    }),
  );
  return {
    configured: accounts.some((account) => account.configured),
    accounts,
  };
}

export function saveElevenLabsAccount(config, payload) {
  const accounts = elevenLabsAccounts(config).map((account) => ({
    ...account,
  }));
  const id = payload.accountId || "legacy";
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(id))
    throw Error("Choose a valid account ID.");
  const index = accounts.findIndex((account) => account.id === id);
  if (payload.removeKey === true) {
    if (index < 0) throw Error("ElevenLabs account not found.");
    accounts.splice(index, 1);
  } else {
    const account =
      index < 0
        ? { id, name: "ElevenLabs account", key: "", enabled: true }
        : accounts[index];
    if (payload.key !== undefined) {
      if (
        typeof payload.key !== "string" ||
        !payload.key.trim() ||
        payload.key.length > 8192 ||
        /[\r\n]/.test(payload.key)
      )
        throw Error("Enter a valid API key.");
      account.key = payload.key.trim();
    }
    if (!account.key) throw Error("Enter an API key for the new account.");
    if (accounts.some((other) => other.id !== id && other.key === account.key))
      throw Error("This API key is already saved.");
    if (payload.name !== undefined) {
      if (
        typeof payload.name !== "string" ||
        !payload.name.trim() ||
        payload.name.length > 100
      )
        throw Error("Enter an account name under 100 characters.");
      account.name = payload.name.trim();
    }
    if (typeof payload.enabled === "boolean") account.enabled = payload.enabled;
    if (index < 0) accounts.push(account);
  }
  config.elevenlabs = { ...config.elevenlabs, key: "", accounts };
}
