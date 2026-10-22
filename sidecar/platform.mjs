import path from 'node:path';
export function platformInfo(platform = process.platform, arch = process.arch) {
  const triples = {
    'darwin-arm64': ['aarch64-apple-darwin', 'aarch64-apple-darwin'],
    'darwin-x64': ['x86_64-apple-darwin', 'x86_64-apple-darwin'],
    'linux-arm64': ['aarch64-unknown-linux-gnu', 'aarch64-unknown-linux-musl'],
    'linux-x64': ['x86_64-unknown-linux-gnu', 'x86_64-unknown-linux-musl'],
    'win32-arm64': ['aarch64-pc-windows-msvc', 'aarch64-pc-windows-msvc'],
    'win32-x64': ['x86_64-pc-windows-msvc', 'x86_64-pc-windows-msvc'],
  };
  const targets = triples[`${platform}-${arch}`];
  if (!targets) throw new Error(`Unsupported desktop platform: ${platform}/${arch}`);
  return { platform, arch, rustTarget: targets[0], codexTarget: targets[1], packageName: `@openai/codex-${platform}-${arch}`, executable: platform === 'win32' ? 'codex.exe' : 'codex', nodeExecutable: platform === 'win32' ? 'node.exe' : 'node' };
}
export function codexLocations(vendorRoot, info = platformInfo()) {
  return [path.join(vendorRoot, info.codexTarget, 'bin', info.executable), path.join(vendorRoot, info.codexTarget, 'codex', info.executable)];
}
