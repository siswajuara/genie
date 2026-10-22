import { afterEach, expect, test } from 'bun:test';
import { saveExport } from '../src/lib/export';
const globals = globalThis as unknown as Record<string, unknown>;
const previousWindow = globals.window, previousTauri = globals.isTauri;
afterEach(() => { globals.window = previousWindow; globals.isTauri = previousTauri; });
function desktop(invoke: (...args: any[]) => Promise<unknown>) {
  globals.isTauri = true;
  globals.window = { __TAURI_INTERNALS__: { invoke } };
}
test('desktop export sends exact PNG bytes and Unicode filename through native IPC without a browser download', async () => {
  const bytes = new Uint8Array([137,80,78,71,13,10,26,10,0,255]);
  desktop(async (command, body, options) => {
    expect(command).toBe('save_export');
    expect(body).toEqual(bytes);
    expect(JSON.parse(options.headers['x-export-name'])).toBe('Slide 1 · Belajar.png');
    return '/exports/Slide 1 · Belajar.png';
  });
  expect(await saveExport(new Blob([bytes], { type: 'image/png' }), 'Slide 1 · Belajar.png')).toEqual({ status:'saved', path:'/exports/Slide 1 · Belajar.png' });
});
test('native save cancellation is reported separately from write failures', async () => {
  desktop(async () => null);
  expect(await saveExport(new Blob(['{}']), 'canvas.json')).toEqual({ status:'cancelled' });
  desktop(async () => { throw new Error('Disk full'); });
  expect(saveExport(new Blob(['{}']), 'canvas.json')).rejects.toThrow('Disk full');
});
