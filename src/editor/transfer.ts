import { validateElements, type Element } from './model';
export const elementMime = 'application/x-siswa-juara-elements';
export function clipboardElements(elements:Element[]) {
  const ids=new Set(elements.map(o=>o.id));
  return JSON.stringify({ type:'siswa-juara/elements', elements:elements.map(o=>({...o,fid:o.fid&&ids.has(o.fid)?o.fid:undefined})) });
}
export function readClipboardElements(text:string):Element[]|undefined {
  if(!text.trim().startsWith('{'))return;
  let value;try{value=JSON.parse(text);}catch{return;}
  if(value?.type!=='siswa-juara/elements')return;
  return validateElements(value.elements);
}
export function isTextInput(target:EventTarget|null) {
  return target instanceof HTMLElement && (target.isContentEditable || !!target.closest('input,textarea,select,[contenteditable],[role="textbox"]'));
}
