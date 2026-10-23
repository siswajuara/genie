import { requestSocialApi } from "./social-api.mjs";
let input = "";
try {
  for await (const chunk of process.stdin) {
    input += chunk;
    if (input.length > 1024 * 1024)
      throw Error(
        "Social request is too large. Upload media directly to storage.",
      );
  }
  const { config, action, payload } = JSON.parse(input);
  process.stdout.write(
    JSON.stringify({ data: await requestSocialApi(config, action, payload) }),
  );
} catch (error) {
  process.stdout.write(
    JSON.stringify({
      error: error.message || "The website API request failed.",
    }),
  );
  process.exitCode = 1;
}
