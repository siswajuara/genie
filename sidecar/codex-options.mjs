export const reasoningEfforts = ["minimal", "low", "medium", "high", "xhigh"];
export function threadOptions(request, workspace) {
  const options = {
    workingDirectory: workspace,
    skipGitRepoCheck: true,
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
  };
  if (request.model) {
    if (
      typeof request.model !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,159}$/.test(request.model)
    )
      throw new Error("Enter a valid model identifier.");
    options.model = request.model;
  }
  if (request.reasoningEffort && request.reasoningEffort !== "default") {
    if (!reasoningEfforts.includes(request.reasoningEffort))
      throw new Error("Unsupported reasoning effort for this SDK.");
    options.modelReasoningEffort = request.reasoningEffort;
  }
  if (request.webSearchMode && request.webSearchMode !== "default") {
    if (!["disabled", "cached", "live"].includes(request.webSearchMode))
      throw new Error("Unsupported web search setting.");
    options.webSearchMode = request.webSearchMode;
  }
  return options;
}
export function modelCatalog(data) {
  return data
    .filter((model) => !model.hidden && typeof model.model === "string")
    .map((model) => ({
      id: model.model,
      label: model.displayName || model.model,
      description: model.description || "",
      isDefault: !!model.isDefault,
      defaultReasoningEffort: model.defaultReasoningEffort,
      efforts: (model.supportedReasoningEfforts || [])
        .filter((item) => reasoningEfforts.includes(item.reasoningEffort))
        .map((item) => ({
          value: item.reasoningEffort,
          description: item.description || "",
        })),
    }));
}
