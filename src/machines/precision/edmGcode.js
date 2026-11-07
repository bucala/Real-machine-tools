// Training sinker EDM subset: safe XY positioning and straight Z burns. G54 Z0
// is the blank top. Unsupported codes fail with a source line, never disappear.
export const EDM_GCODE_SAMPLE=`(EX 500 - two cavities, G54 Z0 = blank top)
G21 G90 G94 G54
M3 M8
G0 Z5
G0 X-20 Y0
G1 Z-8 F3
G0 Z5
G0 X20 Y0
G1 Z-5 F3
G0 Z5
M5 M9
M30`;
export function compileEdmGcode(text){
  if(typeof text!=='string'||text.length>256000)throw new Error('NC: max. 256 kB');
  let x=0,y=0,z=5,absolute=true,mode=0,feed=null,on=true,flush=true,ended=false,startFlushing=null,endFlushing=null,endLine=null;const rows=[];
  const fail=(line,msg)=>{throw new Error(`NC ${line}: ${msg}`);};
  text.split(/\r?\n/).forEach((raw,index)=>{
    const line=index+1,s=raw.replace(/\([^)]*\)/g,'').split(';')[0].trim().toUpperCase();if(!s||s==='%'||/^O\d+$/.test(s))return;
    if(ended)fail(line,'Blok po M30 / Block after M30.');
    const words=[...s.matchAll(/([A-Z])\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/g)];
    if(!words.length||s.replace(/([A-Z])\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/g,'').trim())fail(line,'Neplatný zápis / Invalid syntax.');
    const axis={};let hasMotion=false;
    for(const [,letter,value] of words){const n=Number(value);if(!Number.isFinite(n))fail(line,'Neplatné číslo / Invalid number.');
      if(letter==='N')continue;
      if(letter==='G'){
        if([0,1].includes(n))mode=n;
        else if(n===90)absolute=true;else if(n===91)absolute=false;
        else if(![21,54,94].includes(n))fail(line,`G${n} nie je podporované / unsupported.`);
      }else if(letter==='M'){
        if([2,30].includes(n)){ended=true;endLine=line;}else if(n===3)on=true;else if(n===5)on=false;else if(n===8){flush=true;if(!rows.length)startFlushing=true;endFlushing=true;}else if(n===9){flush=false;if(!rows.length)startFlushing=false;endFlushing=false;}else fail(line,`M${n} nie je podporované / unsupported.`);
      }else if(letter==='F'){if(n<=0||n>100)fail(line,'F musí byť 0–100 mm/min / F must be 0–100 mm/min.');feed=n;}
      else if(['X','Y','Z'].includes(letter)){if(letter in axis)fail(line,'Opakovaná os / Duplicate axis.');axis[letter]=n;hasMotion=true;}
      else fail(line,`${letter} nie je podporované / unsupported.`);
    }
    if(!hasMotion)return;
    const nx='X'in axis?(absolute?axis.X:x+axis.X):x,ny='Y'in axis?(absolute?axis.Y:y+axis.Y):y,nz='Z'in axis?(absolute?axis.Z:z+axis.Z):z;
    if((nx!==x||ny!==y)&&Math.min(z,nz)<5)fail(line,'Pred XY zdvihni elektródu na Z≥5 / Retract to Z≥5 before XY.');
    if(mode===0&&nz<5)fail(line,'Rýchloposuv vyžaduje Z≥5 / Rapid requires Z≥5.');
    if(nz<0){if(!on||!flush)fail(line,'Hĺbenie vyžaduje M3 a M8 / Burn requires M3 and M8.');if(nz>=z)fail(line,'Návrat vykonaj G0 Z5 / Retract using G0 Z5.');if(rows.length&&z<5)fail(line,'Medzi hĺbeniami použi G0 Z5 / Use G0 Z5 between burns.');rows.push({x:nx,y:ny,depth:-nz,line,feed});}
    if(nz>100||nz< -29.5)fail(line,'Z mimo rozsahu / Z outside range.');x=nx;y=ny;z=nz;
  });
  if(!rows.length||rows.length>100)throw new Error('NC: zadaj 1–100 hĺbení / Enter 1–100 burns.');
  if(z<5)throw new Error('NC: ukonči program bezpečným zdvihom G0 Z5 / End with G0 Z5.');
  return {rows,startFlushing,endFlushing,endLine};
}
