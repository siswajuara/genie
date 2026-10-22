// Original drawing routines from reference/siswa-juara-editor.html.
export function drawElement(ctx, o, exporting = false) {
function draw(o){
 const{x,y,w,h}=o;
 if(o.t==='rect'||o.t==='ellipse'){
  ctx.beginPath();
  if(o.t==='rect')ctx.roundRect(x,y,w,h,Math.min(o.r||0,Math.abs(w)/2,Math.abs(h)/2));else ctx.ellipse(x+w/2,y+h/2,Math.abs(w/2),Math.abs(h/2),0,0,7);
  if(o.fill2){const g=ctx.createLinearGradient(x,y,x,y+h);g.addColorStop(0,o.fill);g.addColorStop(1,o.fill2);ctx.fillStyle=g}else ctx.fillStyle=o.fill;ctx.fill();
  if(o.lw>0){ctx.lineWidth=o.lw;ctx.strokeStyle=o.stroke;ctx.stroke()}
 }else if(o.t==='line'){
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y+h);ctx.lineWidth=o.lw;ctx.strokeStyle=o.stroke;ctx.lineCap='round';ctx.stroke();
 }else if(o.t==='text'){
  ctx.font=`${o.weight} ${o.size}px "${o.font}", sans-serif`;ctx.textBaseline='middle';ctx.textAlign=o.align;
  const ls=String(o.text).split('\n'),lh=o.size*1.15,tx=o.align==='center'?x+w/2:o.align==='right'?x+w:x;
  ls.forEach((s,i)=>{const ty=y+h/2+(i-(ls.length-1)/2)*lh;
   if(o.tsw>0){ctx.lineJoin='round';ctx.lineWidth=o.tsw;ctx.strokeStyle=o.tstroke;ctx.strokeText(s,tx,ty)}
   ctx.fillStyle=o.color;ctx.fillText(s,tx,ty)});
 }else if(o.t==='img'){
  if(o.img){const r=(o.fit==='cover'?Math.max:Math.min)(w/o.img.width,h/o.img.height),dw=o.img.width*r,dh=o.img.height*r;ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,o.r||0);ctx.clip();ctx.drawImage(o.img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);ctx.restore()}
  else if(!exporting){
   ctx.fillStyle='rgba(120,140,220,.12)';ctx.fillRect(x,y,w,h);
   ctx.setLineDash([8,6]);ctx.lineWidth=2;ctx.strokeStyle='#6f84e0';ctx.strokeRect(x,y,w,h);ctx.setLineDash([]);
   ctx.fillStyle='#4a5fc4';ctx.textAlign='center';ctx.textBaseline='middle';
   const fs=Math.max(11,Math.min(26,w/9));ctx.font=`800 ${fs}px Nunito,sans-serif`;
   ctx.fillText('IMG',x+w/2,y+h/2-fs*.7);ctx.font=`400 ${fs*.8}px Nunito,sans-serif`;ctx.fillText(o.label,x+w/2,y+h/2+fs*.5,Math.max(10,w-8));
  }
 }
}
function cen(o){return{x:o.x+o.w/2,y:o.y+o.h/2}}
function rotpt(p,o,s){const c=cen(o),a=s*(o.rot||0)*Math.PI/180,dx=p.x-c.x,dy=p.y-c.y;return{x:c.x+dx*Math.cos(a)-dy*Math.sin(a),y:c.y+dx*Math.sin(a)+dy*Math.cos(a)}}
function nrm(o){const l=Math.hypot(o.w,o.h)||1;return{x:-o.h/l,y:o.w/l}}
function hpt(o){return rotpt({x:o.x+o.w,y:o.y+o.h},o,1)}
function bpt(o){const c=cen(o),n=nrm(o),b=o.bend||0;return rotpt({x:c.x+n.x*b,y:c.y+n.y*b},o,1)}
function near(a,b){return Math.hypot(a.x-b.x,a.y-b.y)<24}
function drawObj(o){
 if(o.hide||o.editing)return;ctx.save();ctx.globalAlpha=o.op??1;if(o.sh>0){ctx.shadowBlur=o.sh;ctx.shadowColor=o.shc||'#0006';ctx.shadowOffsetX=o.shx||0;ctx.shadowOffsetY=o.shy||0}
 if(o.rot){const c=cen(o);ctx.translate(c.x,c.y);ctx.rotate(o.rot*Math.PI/180);ctx.translate(-c.x,-c.y)}
 if(o.t==='text')drawText(o);else if(o.t==='line')drawLine(o);else draw(o);
 ctx.restore();
}
function drawLine(o){
 const n=nrm(o),b=o.bend||0;
 ctx.beginPath();ctx.moveTo(o.x,o.y);ctx.quadraticCurveTo(o.x+o.w/2+n.x*b*2,o.y+o.h/2+n.y*b*2,o.x+o.w,o.y+o.h);
 ctx.lineWidth=o.lw;ctx.strokeStyle=o.stroke;ctx.lineCap='round';ctx.setLineDash(o.dash?[1,o.lw*2]:[]);ctx.stroke();ctx.setLineDash([]);
}
function parse(s,def){const out=[],re=/\[c=(#[0-9a-fA-F]{3,8})\]|\[\/c\]/g;let col=def,last=0,m;
 while((m=re.exec(s))){if(m.index>last)out.push({s:s.slice(last,m.index),c:col});col=m[1]||def;last=re.lastIndex}
 if(last<s.length)out.push({s:s.slice(last),c:col});return out}
function drawText(o){
 ctx.font=`${o.weight} ${o.size}px "${o.font}", sans-serif`;ctx.textBaseline='middle';
 const ls=String(o.text).split('\n'),lh=o.size*(o.lh||1.15),cu=(o.curve||0)*Math.PI/180,cx=o.x+o.w/2;
 ls.forEach((s,i)=>{
  const ch=[];parse(s,o.color).forEach(r=>[...r.s].forEach(c=>ch.push({c,k:r.c,w:ctx.measureText(c).width+(o.ls||0)})));
  const tot=ch.reduce((a,b)=>a+b.w,0),by=o.y+o.h/2+(i-(ls.length-1)/2)*lh,R=cu?tot/Math.abs(cu):0;
  const x0=o.align==='center'?cx-tot/2:o.align==='right'?o.x+o.w-tot:o.x;
  for(const pass of [0,1]){
   if(!pass&&!(o.tsw>0))continue;let acc=0;
   ch.forEach(g=>{
    const m=acc+g.w/2;acc+=g.w;let px,py,rt=0;
    if(!cu){px=x0+m;py=by}
    else{const d=(m-tot/2)/R;
     if(cu>0){const a=-Math.PI/2+d;px=cx+R*Math.cos(a);py=by+R+R*Math.sin(a);rt=d}
     else{const a=Math.PI/2-d;px=cx+R*Math.cos(a);py=by-R+R*Math.sin(a);rt=-d}}
    ctx.save();ctx.translate(px,py);ctx.rotate(rt);ctx.textAlign='center';
    if(!pass){ctx.lineJoin='round';ctx.lineWidth=o.tsw;ctx.strokeStyle=o.tstroke;ctx.strokeText(g.c,0,0)}
    else{ctx.fillStyle=g.k;ctx.fillText(g.c,0,0)}
    ctx.restore();
   });
  }
 });
}

drawObj(o);
}
