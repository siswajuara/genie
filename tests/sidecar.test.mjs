import { test } from "node:test";
import assert from "node:assert/strict";
import { platformInfo, codexLocations } from "../sidecar/platform.mjs";
const cases = [
  ["darwin", "arm64", "aarch64-apple-darwin", "aarch64-apple-darwin"],
  ["darwin", "x64", "x86_64-apple-darwin", "x86_64-apple-darwin"],
  ["linux", "arm64", "aarch64-unknown-linux-gnu", "aarch64-unknown-linux-musl"],
  ["linux", "x64", "x86_64-unknown-linux-gnu", "x86_64-unknown-linux-musl"],
  ["win32", "arm64", "aarch64-pc-windows-msvc", "aarch64-pc-windows-msvc"],
  ["win32", "x64", "x86_64-pc-windows-msvc", "x86_64-pc-windows-msvc"],
];
for (const [platform, arch, rust, codex] of cases)
  test(`${platform}/${arch} native packaging targets`, () => {
    const info = platformInfo(platform, arch);
    assert.equal(info.rustTarget, rust);
    assert.equal(info.codexTarget, codex);
    assert.equal(
      info.nodeExecutable,
      platform === "win32" ? "node.exe" : "node",
    );
    assert.equal(info.executable, platform === "win32" ? "codex.exe" : "codex");
    assert.equal(codexLocations("/vendor", info).length, 2);
  });
test("unsupported architectures fail rather than embedding a wrong executable", () => {
  assert.throws(() => platformInfo("linux", "ia32"), /Unsupported/);
  assert.throws(() => platformInfo("android", "arm64"), /Unsupported/);
});
