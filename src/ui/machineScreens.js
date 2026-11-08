import { L } from '../core/i18n';
export function drawRmsScreen(g,w,h,scr){
  g.save();g.scale(w/1024,h/768);g.fillStyle='#b9bdc5';g.fillRect(0,0,1024,768);
  g.fillStyle='#a63243';g.fillRect(0,0,1024,49);g.fillStyle='white';g.font='bold 20px Arial';g.fillText('Röders precision and rapid machining',24,31);g.font='18px Arial';g.fillText('RMS6 · RXU 1001 DSH',730,31);
  g.fillStyle='#e5e6ea';g.fillRect(5,53,1014,39);g.fillStyle='#343b55';g.font='18px Arial';g.fillText('PROGRAM    MACHINE    TOOLS    SETUP    DIAGNOSTICS',24,80);
  const menus=[['Coordinate system','NC program','Manual operation'],['Corrections','Tool management','Job list'],['Geometry','Measurements','Machine configuration'],['Workpiece','Technology data','Simulation'],['Service','Production','Diagnostics']];
  menus.forEach((row,r)=>row.forEach((t,col)=>{g.fillStyle=r===0&&col===1?'#a33d52':'#1635b1';g.fillRect(26+col*245,108+r*67,230,59);g.fillStyle='white';g.font='17px Arial';g.fillText(t,38+col*245,143+r*67);}));
  g.fillStyle='#263498';g.fillRect(783,104,219,448);g.fillStyle='white';g.font='bold 19px Arial';g.fillText(scr?.title||'RMS6 READY',800,134);
  (scr?.pos||[]).forEach(([k,v],i)=>{g.fillStyle='#c2cafa';g.font='18px Arial';g.fillText(k,799,174+i*43);g.fillStyle='white';g.font='20px monospace';g.fillText(v,840,174+i*43);});
  g.fillStyle='#e8e9ed';g.fillRect(20,462,740,91);g.fillStyle='#30394b';g.font='16px Arial';g.fillText('NC / ISO · RXU 1001 DSH · QUADROGUIDE',34,489);g.fillText('X 800   Y 855   Z 500 mm     A / C',34,519);
  g.fillStyle='#e6e7eb';g.fillRect(12,565,1000,155);(scr?.lines||[]).slice(0,6).forEach((ln,i)=>{if(ln.cur){g.fillStyle='#ded7ae';g.fillRect(18,570+i*24,988,23);}g.fillStyle='#343847';g.font='16px monospace';g.fillText(ln.t.slice(0,105),28,588+i*24);});
  g.fillStyle=scr?.alarm?'#ae3345':'#424e7e';g.fillRect(8,729,1008,32);g.fillStyle='white';g.font='17px Arial';g.fillText((scr?.status||L('Pripravený','Ready')).slice(0,104),21,751);g.restore();
}
export function drawOscarScreen(g,w,h,{S,c,oilLevel}){
  g.save();g.scale(w/1040,h/650);g.fillStyle='#edf0ed';g.fillRect(0,0,1040,650);
  g.fillStyle='#4e5650';g.fillRect(0,0,1040,33);g.fillStyle='#f3f5f2';g.font='bold 17px Arial';g.fillText('OSCARMAX     EX 500     CNC EDM',14,23);g.font='14px Arial';g.fillText('AUTO     '+(c.ncMode==='gcode'?'ISO PROGRAM':'OPERATIONS'),688,23);
  ['FILE','EDIT','MACHINE','TOOL','PARAMETER','MONITOR','HELP'].forEach((t,i)=>{g.fillStyle=i===2?'#7c986a':'#d3d8d1';g.fillRect(7+i*145,41,139,32);g.fillStyle=i===2?'white':'#424a43';g.font='13px Arial';g.fillText(t,20+i*145,62);});
  g.fillStyle='#fbfcfa';g.fillRect(10,83,225,377);g.fillStyle='#6d8166';g.fillRect(10,83,225,30);g.fillStyle='white';g.font='15px Arial';g.fillText('ACTUAL POSITION',23,104);
  [['X',S.x],['Y',S.y],['Z',-S.depth]].forEach(([k,v],i)=>{g.fillStyle='#596b57';g.font='16px Arial';g.fillText(k+'  mm',24,155+i*65);g.fillStyle='#252b27';g.font='bold 26px monospace';g.fillText(v.toFixed(3),55,185+i*65);});
  g.font='14px Arial';g.fillStyle='#536050';g.fillText('G54 · ABSOLUTE',25,392);g.fillText('OP '+(S.row+1)+' / '+c.rows.length,25,424);
  g.fillStyle='#f8faf7';g.fillRect(245,83,533,377);g.strokeStyle='#d4ddd1';g.lineWidth=1;for(let i=0;i<9;i++){g.beginPath();g.moveTo(260,140+i*33);g.lineTo(760,140+i*33);g.stroke();}
  const X=x=>510+x*4,Y=y=>260-y*3;g.strokeStyle='#627965';g.lineWidth=2;g.strokeRect(310,140,400,240);c.rows.forEach((r,i)=>{g.fillStyle=i===S.row?'#b7c3a9':'#e0e7dc';g.strokeStyle=i===S.row?'#799559':'#9faa9a';const ew=c.electrode.w*4,ed=(c.electrode.shape==='round'?c.electrode.w:c.electrode.d)*3;g.fillRect(X(r.x)-ew/2,Y(r.y)-ed/2,ew,ed);g.strokeRect(X(r.x)-ew/2,Y(r.y)-ed/2,ew,ed);});
  g.strokeStyle='#364a3b';g.beginPath();g.moveTo(X(S.x)-16,Y(S.y));g.lineTo(X(S.x)+16,Y(S.y));g.moveTo(X(S.x),Y(S.y)-16);g.lineTo(X(S.x),Y(S.y)+16);g.stroke();g.fillStyle='#5c6b59';g.font='14px Arial';g.fillText('WORKPIECE 100 × 80 × 30 mm',270,110);g.fillText((c.electrode.material==='graphite'?'GRAPHITE':'COPPER')+'  '+c.electrode.w+' × '+c.electrode.d+' × '+c.electrode.length+' mm',267,438);
  g.fillStyle='#f9faf7';g.fillRect(789,83,241,377);g.fillStyle='#6d8166';g.fillRect(789,83,241,30);g.fillStyle='white';g.font='15px Arial';g.fillText('DISCHARGE DATA',802,104);
  [['CURRENT',c.current+' A'],['GAP',c.gap.toFixed(2)+' mm'],['OIL LEVEL',oilLevel.toFixed(0)+' mm'],['REMOVED',(S.removed/1000).toFixed(3)+' cm³'],['TIME',S.t.toFixed(1)+' s'],['BLOCK',S.line||'—']].forEach(([k,v],i)=>{g.fillStyle='#e4e9e0';g.fillRect(799,125+i*53,222,48);g.fillStyle='#5d6d56';g.font='12px Arial';g.fillText(k,807,141+i*53);g.fillStyle='#303c2f';g.font='18px monospace';g.fillText(v,807,162+i*53);});
  g.fillStyle='#fff';g.fillRect(10,472,1020,125);let lines=c.ncMode==='gcode'?c.ncText.split(/\r?\n/):c.rows.map((r,i)=>`${i+1}    X ${r.x.toFixed(3)}   Y ${r.y.toFixed(3)}   DEPTH ${r.depth.toFixed(3)}`),current=c.ncMode==='gcode'?Math.max(0,(S.line||1)-1):S.row,start=Math.max(0,current-2);
  lines.slice(start,start+5).forEach((line,i)=>{if(start+i===current){g.fillStyle='#cddbbf';g.fillRect(15,478+i*23,1010,22);}g.fillStyle='#394836';g.font='15px monospace';g.fillText(line.slice(0,105),25,495+i*23);});
  g.fillStyle=S.alarm?'#a94747':'#7a8e6c';g.fillRect(0,608,1040,42);g.fillStyle='white';g.font='16px Arial';g.fillText((S.alarm||S.phase.toUpperCase()+'   ·   '+(S.run?'CYCLE RUN':'READY')).slice(0,114),15,635);g.restore();
}
