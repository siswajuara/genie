export function platformInfo(platform = process.platform, arch = process.arch) {
  const triples = {
    "darwin-arm64": "aarch64-apple-darwin",
    "darwin-x64": "x86_64-apple-darwin",
    "linux-arm64": "aarch64-unknown-linux-gnu",
    "linux-x64": "x86_64-unknown-linux-gnu",
    "win32-arm64": "aarch64-pc-windows-msvc",
    "win32-x64": "x86_64-pc-windows-msvc",
  };
  const rustTarget = triples[`${platform}-${arch}`];
  if (!rustTarget)
    throw new Error(`Unsupported desktop platform: ${platform}/${arch}`);
  return {
    platform,
    arch,
    rustTarget,
    nodeExecutable: platform === "win32" ? "node.exe" : "node",
  };
}
