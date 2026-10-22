import { useRef, useState } from 'react';
import { Canvas } from './editor/Canvas';
import { Inspector } from './editor/Inspector';
import { useEditor } from './editor/useEditor';
import { useProjects, type Projects } from './editor/projects';
import { elementKinds, frames, makeElement, parseDocument, parsePresets, presets, uid, type Element, type Preset } from './editor/model';
import { CodexPanel } from './components/CodexPanel';
import { saveExport, exportMessage } from './lib/export';

export default function App() {
  const projects = useProjects();
  const [tab, setTab] = useState('Editor');
  return <WorkspacePage key={`${projects.page.id}:${projects.importRevision}`} projects={projects} tab={tab} setTab={setTab} />;
}
function WorkspacePage({ projects: p, tab, setTab }: { projects: Projects; tab: string; setTab: (tab: string) => void }) {
  const e = useEditor(p.page.canvas, canvas => p.updatePage(p.page.id, canvas));
  async function download(value: string, filename: string) {
    try { e.notify(exportMessage(await saveExport(new Blob([value], { type: 'application/json' }), filename))); }
    catch (err) { e.notify(`Export failed: ${String(err)}`); }
  }
  const [editorTab, setEditorTab] = useState('Elements');
  const [right, setRight] = useState(true), [json, setJson] = useState(''), [name, setName] = useState(''), [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<'project' | 'page'>();
  const [saved, setSaved] = useState<Preset[]>(() => { try { return parsePresets(JSON.parse(localStorage.getItem('genie.presets') || '[]')); } catch { return []; } });
  const [theme, setTheme] = useState(() => localStorage.getItem('genie.theme') || 'light');
  const jsonInput = useRef<HTMLInputElement>(null);
  const all = [...presets, ...saved], artboards = frames(e.doc);
  function savePresets(next: Preset[]) { setSaved(next); try { localStorage.setItem('genie.presets', JSON.stringify(next)); } catch { e.notify('Preset storage is full. Export JSON to keep your preset.'); } }
  function importJSON(value: string) {
    try {
      const parsed = JSON.parse(value);
      if (parsed?.projects) { p.importWorkspace(parsed); e.notify('Projects imported.'); }
      else if (parsed?.version) { e.change(parseDocument(parsed)); e.select([]); e.notify('Canvas JSON applied.'); }
      else { const imported = parsePresets(parsed); savePresets([...saved, ...imported]); e.notify(`${imported.length} presets imported. Open Editor > Templates to add one.`); }
    } catch (err) { e.notify(`JSON error: ${err instanceof Error ? err.message : String(err)}`); }
  }
  async function loadImages(files: File[], at?: { x: number; y: number }) {
    for (const [index, file] of files.entries()) {
      try {
        const src = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('File could not be read.')); reader.readAsDataURL(file); });
        const img = await new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Unsupported image.')); image.src = src; });
        const o: Element = { id: uid(), t: 'img', n: file.name, label: file.name, src, x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight, fit: 'contain' };
        e.add(o, at ? { x:at.x+index*24, y:at.y+index*24 } : undefined);
      } catch (err) { e.notify(String(err)); }
    }
  }
  function savePreset(kind: 'object' | 'template') { try { const preset = e.preset(kind, name.trim() || `${kind === 'template' ? 'Design' : 'Preset'} ${saved.length + 1}`); savePresets([...saved.filter(s => s.name !== preset.name), preset]); e.notify(`Saved “${preset.name}”.`); } catch (err) { e.notify(String(err)); } }
  return <div className="studio" data-theme={theme}>
    <header className="studio-header">
      <div className="wordmark"><span className="brand-mark">SJ</span><span>Siswa Juara <small>Canvas studio</small></span></div>
      <div className="project-switcher">
        <label><span className="sr-only">Project</span><select aria-label="Project" value={p.project.id} onChange={ev => p.selectProject(ev.target.value)}>{p.workspace.projects.map(project => <option key={project.id} value={project.id}>{project.name || 'Untitled project'}</option>)}</select></label>
        <button onClick={p.createProject}>+ Project</button>
        <details className="workspace-settings"><summary>Project settings</summary><div className="settings-popover"><label>Project name<input aria-label="Project name" value={p.project.name} onChange={ev => p.renameProject(ev.target.value)} /></label><button onClick={p.duplicateProject}>Duplicate project</button><button onClick={() => download(JSON.stringify(p.workspace, null, 2), 'siswa-juara-projects.json')}>Export all projects</button><button className="danger" disabled={p.workspace.projects.length < 2} onClick={() => setConfirmDelete('project')}>Delete project</button></div></details>
      </div>
      <div className="row"><button onClick={() => { const next = theme === 'light' ? 'dark' : 'light'; setTheme(next); localStorage.setItem('genie.theme', next); }}>{theme === 'light' ? 'Dark' : 'Light'}</button><button onClick={() => setRight(!right)}>{right ? 'Hide inspector' : 'Show inspector'}</button><button onClick={() => download(JSON.stringify(e.doc, null, 2), p.page.name + '.json')}>Save canvas</button></div>
    </header>
    <nav className="page-bar" aria-label="Project pages"><span className="page-bar-label">Pages</span><div className="page-list">{p.project.pages.map(page => <button key={page.id} aria-current={page.id === p.page.id ? 'page' : undefined} onClick={() => p.selectPage(page.id)}>{page.name || 'Untitled page'}</button>)}</div><button onClick={() => p.createPage()}>+ Page</button><details className="workspace-settings"><summary>Page settings</summary><div className="settings-popover"><label>Page name<input aria-label="Page name" value={p.page.name} onChange={ev => p.renamePage(ev.target.value)} /></label><button onClick={() => p.createPage(true)}>Duplicate page</button><button className="danger" disabled={p.project.pages.length < 2} onClick={() => setConfirmDelete('page')}>Delete page</button></div></details></nav>
    <main className={`studio-main ${right ? '' : 'without-inspector'}`}>
      <aside className="library">
        <div className="library-tabs" role="tablist" aria-label="Workspace tools">{['Chat', 'Editor', 'Debug'].map(t => <button role="tab" aria-selected={tab === t} key={t} onClick={() => setTab(t)}>{t}</button>)}</div>
        <div className={`library-content ${tab === 'Chat' ? 'chat-content' : ''}`}>
          {tab === 'Editor' && <>
            <div className="editor-tabs" role="tablist" aria-label="Editor library">{['Elements', 'Templates'].map(t => <button key={t} role="tab" aria-selected={editorTab === t} onClick={() => setEditorTab(t)}>{t}</button>)}</div>
            {editorTab === 'Elements' ? <>
              <div className="section-title"><h2>Frames</h2><span>Add a carousel slide</span></div>
              <div className="format-grid">{[['Post 4:5', 1122, 1402], ['Story 9:16', 940, 1672], ['Square', 1080, 1080], ['Wide 16:9', 1280, 720]].map(([n, w, h]) => <button key={n} onClick={() => e.addFrame(Number(w), Number(h), `${n} ${artboards.length + 1}`)}><span className="format-preview" style={{ aspectRatio: `${w}/${h}` }} /><span>{n}</span><small>{w} × {h}</small></button>)}</div>
              {artboards.length > 0 && <div className="frame-list"><h3>On this canvas · {artboards.length}</h3>{artboards.map((f, i) => <button className={e.frame?.id === f.id ? 'active' : ''} key={f.id} onClick={() => e.select([f.id])}><span>{i + 1}</span>{f.n}</button>)}<button disabled={!e.frame} onClick={e.duplicateFrame}>Duplicate active frame</button></div>}
              <h2 className="section-heading">Elements</h2><div className="element-grid">{elementKinds.map(kind => <button draggable key={kind} aria-label={kind} onDragStart={ev => ev.dataTransfer.setData('genie/element', kind)} onClick={() => e.add(makeElement(kind))}><span aria-hidden="true" className="element-symbol">{({ 'Text': 'T', 'Heading': 'H', 'Paragraph': '¶', 'Curved text': '⌒', 'Box': '□', 'Rounded box': '▢', 'Circle': '○', 'Line': '╱', 'Curve': '∿', 'Image slot': '▧' })[kind]}</span>{kind}</button>)}</div><p className="hint">Drop or paste images and text directly onto the canvas. Drag elements into a frame or onto the workspace.</p>
            </> : <>
              <div className="section-title"><h2>Templates & presets</h2><span>{all.length}</span></div><input className="full" placeholder="Search templates" aria-label="Search templates" value={search} onChange={ev => setSearch(ev.target.value)} />
              <div className="template-list">{all.filter(preset => preset.name.toLowerCase().includes(search.toLowerCase())).map((preset, i) => <article className="template-card" key={preset.name + i}><div className="template-icon">{preset.kind === 'template' ? '▤' : 'T'}</div><div><strong>{preset.name}</strong><small>{preset.kind === 'template' ? `${preset.W} × ${preset.H}` : `${preset.objects.length} elements`}{preset.b ? ' · Built-in' : ' · Saved'}</small></div><div className="row"><button onClick={() => e.template(preset)}>Add</button>{preset.kind === 'template' && <button disabled={!e.frame} onClick={() => e.template(preset, true)}>Replace frame</button>}{!preset.b && <button className="danger" onClick={() => savePresets(saved.filter(s => s !== preset))}>Delete</button>}</div></article>)}</div>
              <h3>Save a preset</h3><input className="full" aria-label="Preset name" placeholder="Preset name" value={name} onChange={ev => setName(ev.target.value)} /><div className="row section-actions"><button onClick={() => savePreset('object')}>Save selection</button><button onClick={() => savePreset('template')}>Save frame</button></div>
            </>}
          </>}
          <div hidden={tab !== 'Chat'} className="codex-wrapper"><CodexPanel editor={e} scope={`${p.project.id}-${p.page.id}`} /></div>
          {tab === 'Debug' && <><h2>Canvas JSON</h2><p className="hint">Current page: {p.page.name}. Edit metadata and elements, import presets, or export a backup of all projects and pages.</p><div className="row section-actions"><button onClick={() => setJson(JSON.stringify(e.doc, null, 2))}>Read canvas</button><button onClick={() => { try { setJson(JSON.stringify(e.preset('template', e.frame?.n || 'Frame'), null, 2)); } catch (err) { e.notify(String(err)); } }}>Read frame</button><button onClick={() => { try { setJson(JSON.stringify(e.preset('object', 'Selection'), null, 2)); } catch (err) { e.notify(String(err)); } }}>Read selection</button><button onClick={() => setJson(JSON.stringify(p.workspace, null, 2))}>Read projects</button><button onClick={() => jsonInput.current?.click()}>Open .json</button></div><textarea className="json-editor" spellCheck={false} aria-label="Canvas or preset JSON" value={json} onChange={ev => setJson(ev.target.value)} placeholder="Read the canvas or paste JSON here" /><div className="row"><button className="primary" onClick={() => importJSON(json)}>Apply JSON</button><button disabled={!json} onClick={() => download(json, 'canvas.json')}>Download</button></div></>}
        </div>
      </aside>
      <Canvas editor={e} onImage={loadImages} />{right && <Inspector editor={e} />}
    </main>
    <footer className="studio-footer"><span role="status">{p.storageError || e.storageError || e.notice}</span><span>{p.project.name} / {p.page.name} · {artboards.length} frames · {e.selection.length} selected</span></footer>
    {confirmDelete && <div className="dialog-backdrop" onKeyDown={ev => { if (ev.key === 'Escape') setConfirmDelete(undefined); }}><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title"><h2 id="delete-title">Delete {confirmDelete === 'project' ? p.project.name : p.page.name}?</h2><p>{confirmDelete === 'project' ? 'This removes the project and all its pages.' : 'This removes this page and its canvas.'} Export a JSON backup first if you want to keep it.</p><div className="row"><button autoFocus onClick={() => setConfirmDelete(undefined)}>Cancel</button><button className="danger" onClick={() => { if (confirmDelete === 'project') p.deleteProject(); else p.deletePage(); setConfirmDelete(undefined); }}>Delete {confirmDelete}</button></div></section></div>}
    <input ref={jsonInput} hidden type="file" accept=".json,application/json" onChange={async ev => { const file = ev.target.files?.[0]; if (file) { const value = await file.text(); setJson(value); importJSON(value); } ev.target.value = ''; }} />
  </div>;
}
