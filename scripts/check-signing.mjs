const required = [
  "APPLE_CERTIFICATE",
  "APPLE_CERTIFICATE_PASSWORD",
  "APPLE_SIGNING_IDENTITY",
  "APPLE_ID",
  "APPLE_PASSWORD",
  "APPLE_TEAM_ID",
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length)
  throw new Error(
    `Signed macOS builds require repository secrets: ${missing.join(", ")}. Use a manual unsigned preview build for development.`,
  );
console.log("macOS signing and notarization credentials are configured.");
