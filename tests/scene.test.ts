import { describe, expect, test } from 'bun:test';
import { buildScene, containsPoint, hitElements, nodeElements, orderLayers, reparentOnDrop, dropLayer } from '../src/editor/scene';
import type { Element } from '../src/editor/model';
const frame=(id:string,x=0):Element=>({id,t:'frame',n:id,x,y:0,w:400,h:400,fill:'#fff'});
const box=(id:string,fid='f1',x=30,y=30):Element=>({id,t:'rect',n:id,fid,x,y,w:100,h:80,r:20,fill:'#f7c600'});
describe('frame hierarchy and canvas selection regressions',()=>{
  test('sending a resized rounded box behind siblings keeps it in its frame and selectable',()=>{
    const rounded={...box('rounded'),w:250,h:200},f1=frame('f1'),f2=frame('f2',500);
    const objects=[f1,box('other','f1',310,300),f2,box('other-frame','f2',520,20),rounded];
    const result=orderLayers(objects,['rounded'],-1,true),scene=buildScene(result);
    expect(scene.frameChildren.get('f1')?.map(o=>o.id)).toEqual(['rounded','other']);
    expect(result.find(o=>o.id==='rounded')?.fid).toBe('f1');
    expect(hitElements(scene,{x:60,y:60})[0].id).toBe('rounded');
    expect(scene.tree.find(n=>n.id==='f1')?.children.map(n=>n.id)).toEqual(['rounded','other']);
  });
  test('backward/forward operations never cross frame boundaries',()=>{
    const objects=[frame('f1'),box('a'),box('b'),frame('f2',500),box('c','f2',520)];
    const result=orderLayers(objects,['a','c'],1,true),scene=buildScene(result);
    expect(scene.frameChildren.get('f1')?.map(o=>o.id)).toEqual(['b','a']);
    expect(scene.frameChildren.get('f2')?.map(o=>o.id)).toEqual(['c']);
    const behind=buildScene(orderLayers(result,['f2'],-1,true));
    expect(behind.frames.map(f=>f.id)).toEqual(['f2','f1']);
    expect(behind.frameChildren.get('f2')?.[0].fid).toBe('f2');
  });
  test('legacy children before a frame are hit above the frame background',()=>{
    const scene=buildScene([box('a'),frame('f1')]);
    expect(scene.paint.map(o=>o.id)).toEqual(['f1','a']);
    expect(hitElements(scene,{x:60,y:60}).map(o=>o.id)).toEqual(['a','f1']);
  });
  test('clicks, resizing beyond an edge, and drops on empty canvas retain parent ownership',()=>{
    const outside=box('a','f1',380,380),objects=[frame('f1'),outside,frame('f2',500)];
    expect(reparentOnDrop(objects,['a'],false)).toBe(objects);
    expect(reparentOnDrop(objects,['a'],true).find(o=>o.id==='a')?.fid).toBe('f1');
    const moved=objects.map(o=>o.id==='a'?{...o,x:520,y:30}:o);
    expect(reparentOnDrop(moved,['a'],true).find(o=>o.id==='a')?.fid).toBe('f2');
  });
  test('groups are scoped inside frames and move as sibling blocks',()=>{
    const objects=[frame('f1'),{...box('a'),gid:'g'},box('b'),{...box('c'),gid:'g'},frame('f2',500),{...box('d','f2',520),gid:'g'}];
    const scene=buildScene(orderLayers(objects,['a','c'],-1,true));
    const f1=scene.tree.find(n=>n.id==='f1')!;
    expect(f1.children[0].group).toBe('g');
    expect(nodeElements(f1.children[0]).map(o=>o.id)).toEqual(['a','c']);
    expect(scene.frameChildren.get('f2')?.map(o=>o.id)).toEqual(['d']);
  });
  test('layer drag reorder preserves the parent and cannot silently reparent',()=>{
    const objects=[frame('f1'),box('a'),box('b'),frame('f2',500),box('c','f2',520)];
    expect(buildScene(dropLayer(objects,['a'],'b')).frameChildren.get('f1')?.map(o=>o.id)).toEqual(['b','a']);
    expect(dropLayer(objects,['a'],'c')).toBe(objects);
  });
  test('hidden and locked frames suppress child canvas hits; curved lines use stroke geometry',()=>{
    expect(hitElements(buildScene([{...frame('f1'),lock:true},box('a')]),{x:60,y:60})).toEqual([]);
    expect(hitElements(buildScene([{...frame('f1'),hide:true},box('a')]),{x:60,y:60})).toEqual([]);
    const line:Element={id:'line',t:'line',n:'curve',x:0,y:0,w:200,h:0,bend:80,lw:4};
    expect(containsPoint(line,{x:100,y:80})).toBe(true);
    expect(containsPoint(line,{x:10,y:80})).toBe(false);
  });
});
