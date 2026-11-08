import { L } from '../../core/i18n';
import { EX500 } from './profiles';
const within=(x,r)=>Number.isFinite(x)&&x>=r[0]&&x<=r[1];

// ---------- výučbový fyzikálny model hĺbenia (meď / grafit proti oceli, hrubovanie až dokončovanie) ----------
// Úber je úmerný prúdu: MRR = k · I (mm³/min). Rýchlosť hĺbenia = úber / plocha čela elektródy, takže veľká
// elektróda hĺbi pomalšie. Prúd určuje aj výbojovú medzeru (bočný presah) a drsnosť Ra / VDI 3400.
// Koeficienty sú orientačné hodnoty z tabuliek generátorov, nie údaje OSCARMAX.
export const EDM_MATERIALS={
  copper:{k:7,wear:.02,name:['Meď','Copper']},
  graphite:{k:10,wear:.008,name:['Grafit','Graphite']},
};
const matOf=e=>EDM_MATERIALS[e?.material]||EDM_MATERIALS.copper;
export const edmArea=e=>e.shape==='round'?Math.PI*e.w*e.w/4:e.w*e.d;                 // mm²
export const edmGap=I=>Math.round((.01+.0045*I)*1000)/1000;                              // mm na stranu
export const edmRa=I=>.5*I**.75;                                                          // µm
export const edmVdi=I=>20*Math.log10(edmRa(I)/.1);                                        // VDI 3400
export const edmMrr=(e,I)=>matOf(e).k*I;                                                  // mm³/min
export const edmFeed=(e,I)=>edmMrr(e,I)/edmArea(e);                                       // mm/min do hĺbky
export const edmRelWear=e=>matOf(e).wear;                                                 // objem elektródy / objem obrobku
export function validateEdmJob({rows,electrode,current,gap,oilLevel,fixtureHeight=0},stock){
  if(!Array.isArray(rows)||!rows.length||rows.length>100)throw new Error(L('Zadaj 1–100 operácií.','Enter 1–100 operations.'));
  if(!within(current,[1,EX500.current]))throw new Error(L('Generátor: 1–60 A.','Generator: 1–60 A.'));
  if(!within(gap,[.01,.3]))throw new Error(L('Medzera: 0,01–0,30 mm.','Gap: 0.01–0.30 mm.'));
  if(!electrode||!['box','round'].includes(electrode.shape)||![electrode.w,electrode.d,electrode.length].every(v=>within(v,[1,200])))throw new Error(L('Neplatná elektróda.','Invalid electrode.'));
  if(!within(oilLevel,[stock.max[2]+40,EX500.tankHeight]))throw new Error(L('Dielektrikum musí byť ≥40 mm nad obrobkom.','Dielectric must cover the workpiece by ≥40 mm.'));
  for(const r of rows){
    if(r.feed!=null&&!within(r.feed,[.001,100]))throw new Error(L('Neplatný posuv.','Invalid feed.'));
    if(!within(r.x,EX500.X)||!within(r.y,EX500.Y))throw new Error(L('Poloha mimo dráh X/Y.','X/Y travel exceeded.'));
    if(!within(r.depth,[.1,stock.max[2]-stock.min[2]-.5]))throw new Error(L('Hĺbka zasahuje do upnutia.','Depth intersects the fixture.'));
    const low=fixtureHeight+stock.max[2]-r.depth+electrode.length;
    if(low<EX500.chuck[0]||fixtureHeight+stock.max[2]+5+electrode.length>EX500.chuck[1])throw new Error(L('Elektróda nedosiahne obrobok v rozsahu výšky upínača.','Electrode cannot reach within chuck clearance.'));
    const rx=(electrode.shape==='round'?electrode.w:electrode.w)/2+gap,ry=(electrode.shape==='round'?electrode.w:electrode.d)/2+gap;
    if(r.x-rx<stock.min[0]||r.x+rx>stock.max[0]||r.y-ry<stock.min[1]||r.y+ry>stock.max[1])throw new Error(L('Elektróda presahuje obrobok.','Electrode exceeds the blank.'));
  }
}
// Educational servo model, not OSCARMAX generator firmware. SDF removal follows
// the actual electrode footprint + gap, so Hold/export preserves the current cavity.
export function createEdmProcess(stock){
  const S={phase:'idle',row:0,x:0,y:0,depth:-5,t:0,removed:0,wear:0,ra:0,run:false,done:false,alarm:null,sparking:false};
  let job=null;
  const start=config=>{
    try{validateEdmJob(config,stock);}catch(e){S.alarm=e.message;return false;}
    if(S.done)return false;
    if(!job){job=structuredClone(config);S.phase='position';}
    S.alarm=null;S.run=true;return true;
  };
  const hold=()=>{S.run=false;S.sparking=false;};
  const stop=message=>{hold();S.alarm=message;};
  const advance=(dt,{door=false,oilLevel=0,flushing=true,estop=false}={})=>{
    S.sparking=false;if(!S.run)return;
    if(door||estop||oilLevel<stock.max[2]+40||!flushing){stop(door?L('Zatvor nádrž.','Close the tank.'):estop?L('Núdzový STOP.','Emergency STOP.'):!flushing?L('Zapni výplach.','Enable flushing.'):L('Nízka hladina dielektrika.','Low dielectric level.'));return;}
    // Bounded steps avoid both tunnelling and a long unresponsive fast-forward frame.
    let left=Math.min(dt,120),steps=0;
    while(left>1e-8&&S.run&&steps++<600){
      const h=Math.min(left,.2);left-=h;S.t+=h;
      const row=job.rows[S.row];S.line=row.line||null;
      if(S.phase==='position'){
        const dist=Math.hypot(row.x-S.x,row.y-S.y),k=Math.min(1,h*100/Math.max(.001,dist));S.x+=(row.x-S.x)*k;S.y+=(row.y-S.y)*k;
        if(dist<.01){S.x=row.x;S.y=row.y;S.phase='burn';}
      }else if(S.phase==='burn'){
        const speed=Math.min(edmFeed(job.electrode,job.current)/60,row.feed==null?Infinity:row.feed/60); // mm/s podľa úberu a plochy
        S.depth=Math.min(row.depth,S.depth+h*(S.depth<0?4:speed));
        if(S.depth>0){
          const e=job.electrode,z=stock.max[2]-S.depth,rx=e.w/2+job.gap,ry=e.d/2+job.gap;
          if(e.shape==='box')stock.cutBox([S.x-rx,S.y-ry,z-job.gap],[S.x+rx,S.y+ry,stock.max[2]+1]);
          else stock.cut([S.x,S.y,z-job.gap],[0,0,1],{kind:'mill',d:e.w+2*job.gap,cr:0,lc:stock.max[2]-stock.min[2]+10});
          S.sparking=true;S.removed=stock.removed();S.wear=S.removed*edmRelWear(e)/edmArea(e);S.ra=edmRa(job.current);
        }
        if(S.depth>=row.depth)S.phase='retract';
      }else if(S.phase==='retract'){
        S.depth=Math.max(-5,S.depth-h*8);
        if(S.depth<=-5){S.row++;if(S.row>=job.rows.length){S.done=true;S.run=false;S.phase='done';S.row=job.rows.length-1;S.line=job.ncCommands?.endLine||row.line||null;}else S.phase='position';}
      }
    }
  };
  return {S,start,hold,stop,advance,get job(){return job;}};
}
