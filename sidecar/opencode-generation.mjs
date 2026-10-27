import { buildScriptPrompt, parseGenerationResult } from "./generate.mjs";
import {
  connectOpenCode,
  modelCatalog,
  pickModel,
  extractJson,
  openCodeError,
} from "./opencode.mjs";

export async function generateScript(
  config,
  request,
  fetchImpl = fetch,
  runtime = {},
) {
  const prompt = buildScriptPrompt(request);
  if (request.confirmed !== true)
    throw Error("Start generation explicitly before using model credits.");
  const { client, settings } = await connectOpenCode(
    config,
    fetchImpl,
    runtime,
  );
  let models;
  try {
    models = modelCatalog(
      await client.model.list(undefined, {
        signal: AbortSignal.timeout(30000),
      }),
    );
  } catch (error) {
    throw openCodeError(error, "list models");
  }
  const model = pickModel(models, settings.model);
  let body;
  try {
    body = await client.generate.text(
      { model, prompt: `${prompt.system}\n\n${prompt.user}` },
      { signal: AbortSignal.timeout(180000) },
    );
  } catch (error) {
    throw openCodeError(error, "generate content", model);
  }
  const text =
    typeof body === "string" ? body : (body?.text ?? body?.data?.text);
  const result = parseGenerationResult(extractJson(text), request);
  // The one-shot SDK response currently reports text only. Never estimate billed tokens.
  return { ...result, model, usage: null };
}
