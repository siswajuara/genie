import { memo, useEffect, useRef, useState } from 'react';
import { nodeElements, type LayerNode } from './scene';
import type { Editor } from './useEditor';
export const LayerTree = memo(function LayerTree({ editor:e }: { editor:Editor }) {
  const [closed,setClosed] = useState<Set<string>>(new Set());
  const [dragging,setDragging] = useState<string[]>([]), [dropTarget,setDropTarget] = useState('');
  const host = useRef<HTMLDivElement>(null), anchor=useRef<string | undefined>(undefined);
  const selection = new Set(e.selection);
  useEffect(() => {
    const open = new Set<string>();
    const visit = (node:LayerNode, ancestors:string[]) => {
      if(node.element&&selection.has(node.id))ancestors.forEach(id=>open.add(id));
      node.children.forEach(child=>visit(child,[...ancestors,node.id]));
    };
    e.scene.tree.forEach(n=>visit(n,[]));
    setClosed(old=>{if(![...open].some(id=>old.has(id)))return old;const next=new Set(old);open.forEach(id=>next.delete(id));return next;});
  },[e.selection,e.scene]);
  function toggle(id:string){setClosed(old=>{const next=new Set(old);if(next.has(id))next.delete(id);else next.add(id);return next;});}
  function choose(node:LayerNode, extend=false, additive=false) {
    const ids=node.element?[node.id]:nodeElements(node).map(o=>o.id);
    if(extend&&anchor.current){
      const rows=Array.from(host.current?.querySelectorAll<HTMLElement>('[role=treeitem]')||[]);
      const from=rows.findIndex(row=>row.dataset.layerId===anchor.current),to=rows.findIndex(row=>row.dataset.layerId===node.id);
      if(from>=0&&to>=0){const selected=rows.slice(Math.min(from,to),Math.max(from,to)+1).flatMap(row=>JSON.parse(row.dataset.selection || '[]') as string[]);e.select([...new Set([...e.selection,...selected])]);return;}
    }
    e.select(additive?ids.every(id=>selection.has(id))?e.selection.filter(id=>!ids.includes(id)):[...new Set([...e.selection,...ids])]:ids);
    anchor.current=node.id;
  }
  function row(node:LayerNode,depth:number) {
    const o=node.element, members=o?[o]:nodeElements(node), ids=members.map(o=>o.id);
    const branch=!!node.children.length || o?.t==='frame', expanded=!closed.has(node.id);
    const selected=ids.every(id=>selection.has(id)), hidden=members.every(o=>e.scene.isHidden(o)), locked=members.every(o=>e.scene.isLocked(o));
    const parentFrame=members[0]?.fid?e.scene.byId.get(members[0].fid):undefined;
    const label=o?.n || 'Group';
    return <div key={node.id} className="layer-branch">
      <div role="treeitem" aria-label={label} aria-level={depth+1} aria-expanded={branch?expanded:undefined} aria-selected={selected} tabIndex={0}
        data-layer-id={node.id} data-selection={JSON.stringify(ids)}
        className={`layer tree-layer ${selected?'selected':''} ${o?.t==='frame'?'frame-layer':''} ${hidden?'is-hidden':''} ${dropTarget===node.id?'drop-target':''}`}
        style={{paddingLeft:depth*14}} draggable
        onClick={ev=>choose(node,ev.shiftKey,ev.metaKey||ev.ctrlKey)}
        onDoubleClick={()=>{choose(node);if(branch)toggle(node.id);}}
        onDragStart={ev=>{const source=selected?e.selection:ids;setDragging(source);ev.dataTransfer.effectAllowed='move';ev.dataTransfer.setData('genie/layers',JSON.stringify(source));}}
        onDragOver={ev=>{if(!dragging.length)return;ev.preventDefault();ev.dataTransfer.dropEffect='move';setDropTarget(node.id);}}
        onDragLeave={()=>setDropTarget('')}
        onDrop={ev=>{ev.preventDefault();ev.stopPropagation();try{e.drop(JSON.parse(ev.dataTransfer.getData('genie/layers')),node.id);}catch{e.notify('Could not reorder those layers.');}setDragging([]);setDropTarget('');}}
        onDragEnd={()=>{setDragging([]);setDropTarget('');}}
        onKeyDown={ev=>{
          if(ev.target!==ev.currentTarget)return;
          const rows=Array.from(host.current?.querySelectorAll<HTMLElement>('[role=treeitem]')||[]),index=rows.indexOf(ev.currentTarget);
          if(['ArrowDown','ArrowUp','Home','End'].includes(ev.key)){ev.preventDefault();rows[ev.key==='Home'?0:ev.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,index+(ev.key==='ArrowDown'?1:-1)))]?.focus();}
          if(ev.key==='ArrowRight'){ev.preventDefault();if(branch&&!expanded)toggle(node.id);else rows[index+1]?.focus();}
          if(ev.key==='ArrowLeft'){ev.preventDefault();if(branch&&expanded)toggle(node.id);else{const previous=rows.slice(0,index).reverse().find(row=>Number(row.getAttribute('aria-level'))<depth+1);previous?.focus();}}
          if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();choose(node,ev.shiftKey,ev.ctrlKey||ev.metaKey);}
        }}>
        {branch?<button className="layer-disclosure" aria-label={`${expanded?'Collapse':'Expand'} ${label}`} tabIndex={-1} onClick={ev=>{ev.stopPropagation();toggle(node.id);}}>{expanded?'▾':'▸'}</button>:<span className="layer-disclosure"/>}
        <span className="layer-icon" aria-hidden="true">{o?({frame:'▤',text:'T',img:'▧',rect:'□',ellipse:'○',line:'╱'})[o.t]:'▱'}</span>
        <span className="tree-layer-name" title={label}>{label}</span>
        {branch&&<small className="layer-count">{o?.t==='frame'?(e.scene.frameChildren.get(o.id)?.length||0):members.length}</small>}
        <button disabled={!!parentFrame?.hide} aria-label={`${hidden?'Show':'Hide'} ${label}`} title={parentFrame?.hide?'Hidden by its frame':hidden?'Show layer':'Hide layer'} onClick={ev=>{ev.stopPropagation();e.patch({hide:!hidden},ids);}}>{hidden?'◌':'◉'}</button>
        <button disabled={!!parentFrame?.lock} aria-label={`${locked?'Unlock':'Lock'} ${label}`} title={parentFrame?.lock?'Locked by its frame':locked?'Unlock layer':'Lock layer'} onClick={ev=>{ev.stopPropagation();e.patch({lock:!locked},ids);}}>{locked?'▣':'□'}</button>
      </div>
      {branch&&expanded&&<div role="group">{[...node.children].reverse().map(child=>row(child,depth+1))}{!node.children.length&&<p className="layer-empty" style={{paddingLeft:(depth+1)*14+22}}>Empty frame</p>}</div>}
    </div>;
  }
  return <><div className="section-title"><h2>Layers</h2><span>{e.doc.elements.length}</span></div><p className="hint">Frames contain their layers. Drag sibling rows to reorder. Shift selects a range; Ctrl/Cmd adds to selection.</p><div ref={host} className="layers layer-tree" role="tree" aria-label="Canvas layers" aria-multiselectable="true">{[...e.scene.tree].reverse().map(node=>row(node,0))}</div>{!e.doc.elements.length&&<p className="empty">No layers yet. Add a frame to begin.</p>}</>;
}, (previous,next) => previous.editor.committed === next.editor.committed && previous.editor.selection === next.editor.selection);
