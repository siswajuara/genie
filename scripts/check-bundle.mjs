import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.env.DESKTOP_TARGET;
if (!target) throw new Error('DESKTOP_TARGET must name the Rust build target.');
const bundle = path.join(root, 'src-tauri/target', target, 'release/bundle');
const check = path.join(root, 'scripts/check-sidecar.mjs');
async function find(directory, filename) {
  for (const entry of await fs.readdir(directory, { withFileTypes:true })) {
    const full = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === filename) {
      try { await fs.access(path.join(directory, 'codex-bridge.mjs')); return full; } catch { /* Ignore manifests belonging to bundled CLI resources. */ }
    }
    if (entry.isDirectory()) { const result = await find(full, filename); if (result) return result; }
  }
}
if (process.platform === 'darwin') {
  const apps = (await fs.readdir(path.join(bundle, 'macos'))).filter(name => name.endsWith('.app'));
  if (apps.length !== 1) throw new Error('Expected one macOS application bundle.');
  execFileSync(process.execPath, [check, path.join(bundle, 'macos', apps[0], 'Contents/Resources/sidecar')], { stdio:'inherit' });
} else if (process.platform === 'linux') {
  const debDirectory = path.join(bundle, 'deb');
  const deb = (await fs.readdir(debDirectory)).find(name => name.endsWith('.deb'));
  if (!deb) throw new Error('Debian installer was not generated.');
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'genie-install-'));
  try {
    execFileSync('dpkg-deb', ['--extract',path.join(debDirectory,deb),temporary]);
    const manifest = await find(temporary, 'manifest.json');
    if (!manifest) throw new Error('Installer is missing the sidecar manifest.');
    execFileSync(process.execPath, [check,path.dirname(manifest)], { stdio:'inherit' });
  } finally { await fs.rm(temporary,{ recursive:true,force:true }); }
} else {
  // Silent NSIS installation checks the actual resource layout with a path containing spaces.
  const nsis = path.join(bundle, 'nsis');
  const installer = (await fs.readdir(nsis)).find(name => name.endsWith('.exe'));
  if (!installer) throw new Error('Windows installer was not generated.');
  const temporary = path.join(os.tmpdir(), 'Genie Installer Check ' + Date.now());
  try {
    execFileSync(path.join(nsis,installer), ['/S',`/D=${temporary}`], { timeout:120000, windowsVerbatimArguments:true });
    const manifest = await find(temporary, 'manifest.json');
    if (!manifest) throw new Error('Installer is missing the sidecar manifest.');
    execFileSync(process.execPath,[check,path.dirname(manifest)], { stdio:'inherit' });
  } finally { await fs.rm(temporary,{recursive:true,force:true}); }
}
console.log('PASS: final installer payload starts its bundled Node and Codex.');
