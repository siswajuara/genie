import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { codexLocations, platformInfo } from './platform.mjs';
const exec = promisify(execFile);
const directory = path.dirname(fileURLToPath(import.meta.url));
async function firstFile(paths) {
  for (const file of paths) { try { await fs.access(file); return file; } catch { /* Try the next supported package layout. */ } }
  throw new Error('The Codex installation is missing its native executable.');
}
export async function packageExecutable(require) {
  const info = platformInfo();
  const packageJson = require.resolve('@openai/codex/package.json');
  const cliRequire = createRequire(packageJson);
  let vendor;
  try { vendor = path.join(path.dirname(cliRequire.resolve(`${info.packageName}/package.json`)), 'vendor'); }
  catch { vendor = path.join(path.dirname(packageJson), 'vendor'); }
  return firstFile(codexLocations(vendor, info));
}
async function validate(binary) {
  await fs.access(binary, process.platform === 'win32' ? 0 : 1);
  if (process.platform === 'darwin') {
    try { await exec('/usr/bin/codesign', ['--verify', '--strict', binary]); }
    catch { throw new Error('Codex failed macOS signature verification. Install a signed app build or select a valid official CLI in Chat settings.'); }
  }
  return binary;
}
export async function resolveCodexExecutable(override) {
  const explicit = override?.trim() || process.env.CODEX_PATH;
  if (explicit) {
    let binary = await fs.realpath(explicit);
    if (/\.(?:m?js|cmd|ps1)$/i.test(binary)) binary = await packageExecutable(createRequire(binary));
    return validate(binary);
  }
  // A prepared release must use its own matching CLI and fail clearly if resources are incomplete.
  try {
    const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'));
    if (manifest.platform !== process.platform || manifest.arch !== process.arch) throw new Error(`Sidecar architecture mismatch: expected ${process.platform}/${process.arch}, got ${manifest.platform}/${manifest.arch}.`);
    return await validate(await firstFile(codexLocations(path.join(directory, 'codex', 'vendor'))));
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const names = process.platform === 'win32' ? ['codex.exe', 'codex.cmd'] : ['codex'];
  const dirs = [...new Set([path.dirname(process.execPath), ...(process.env.PATH || '').split(path.delimiter), '/opt/homebrew/bin', '/usr/local/bin'])];
  for (const candidate of dirs.flatMap(dir => names.map(name => path.join(dir, name)))) {
    if (/[/\\]sidecar[/\\]node_modules[/\\]/.test(candidate)) continue;
    try {
      let binary = await fs.realpath(candidate);
      if (/\.(?:m?js|cmd|ps1)$/i.test(binary)) binary = await packageExecutable(createRequire(binary));
      return await validate(binary);
    } catch (error) { if (error.message.includes('signature')) throw error; }
  }
  throw new Error('No Codex CLI found. Use a packaged desktop build, or install the official CLI and log in for development.');
}
export function codexEnvironment(binary) {
  const root = path.dirname(path.dirname(binary));
  const helperDirs = [path.dirname(process.execPath), path.dirname(binary), path.join(root, 'codex-path'), path.join(root, 'path')];
  const env = { ...process.env, CODEX_MANAGED_BY_NPM: '1' };
  const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH';
  env[pathKey] = [...helperDirs, env[pathKey] || ''].join(path.delimiter);
  return env;
}
