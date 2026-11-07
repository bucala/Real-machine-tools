// Manufacturer values: supplied Xpert Pro technical data, PDF page 4,
// standard 320/4300 column. Process timing and springback are training estimates.
export const XPERT320=Object.freeze({length:5260,width:2000,height:3170,force:3200,bendLength:4300,stroke:250,openHeight:640,frameGap:3750,throat:400,tableWidth:74,xRange:1050,xTravel:600,rTravel:250,zTravel:2900,oil:600,mass:24300,power:34,yAccuracy:.004});
export const BRAKE_MATERIALS={steel:{rm:450,spring:2.2},stainless:{rm:700,spring:3.2},aluminium:{rm:250,spring:1.4}};
export const OPEN_TIP=180; // Selected tool stack leaves 180 mm above the die.
const rad=Math.PI/180;
export const brakeForce=c=>1.42*BRAKE_MATERIALS[c.material].rm*c.length*c.thickness**2/c.v/1000;
export const insideRadius=c=>Math.max(.16*c.v,.8*c.thickness);
export const springback=c=>BRAKE_MATERIALS[c.material].spring*Math.sqrt(c.v/(8*c.thickness));
export function supportDepth(c,beta){
  const r=insideRadius(c)+c.thickness/2;
  return r*(1-Math.cos(beta))+(c.v/2-r*Math.sin(beta))*Math.tan(beta);
}
export function brakeSetup(c){
  if(!c||!BRAKE_MATERIALS[c.material])throw new Error('Vyber materiál. / Select material.');
  for(const [key,min,max] of [['thickness',.5,12],['length',100,XPERT320.bendLength],['depth',80,1400],['flange',20,XPERT320.xRange],['v',16,120],['angle',90,170]]){
    if(!Number.isFinite(c[key])||c[key]<min||c[key]>max)throw new Error(`Rozmer mimo rozsahu: ${key}. / Dimension outside range.`);
  }
  if(c.v<6*c.thickness)throw new Error('V-matrica je príliš úzka pre hrúbku plechu. / V-die is too narrow.');
  if(Math.min(c.flange,c.depth-c.flange)<.7*c.v)throw new Error('Krátke rameno nedosiahne na oporu matrice. / Flange does not reach the die shoulder.');
  if(c.length>XPERT320.frameGap&&c.flange>XPERT320.throat)throw new Error('Široký plech presahuje vyloženie rámu 400 mm. / Wide sheet exceeds the 400 mm frame throat.');
  const force=brakeForce(c),spring=springback(c),beta=(180-c.angle+spring)*rad/2;
  if(180-beta/rad*2<85)throw new Error('Kompenzovaný uhol prekračuje 85° nástroj. / Compensated angle exceeds 85° tooling.');
  if(force>XPERT320.force)throw new Error('Prekročená sila 3 200 kN. / 3,200 kN capacity exceeded.');
  const contact=OPEN_TIP-c.thickness,target=contact+supportDepth(c,beta);
  if(target>XPERT320.stroke)throw new Error('Ohyb presahuje zdvih 250 mm. / Bend exceeds 250 mm stroke.');
  return {force,spring,beta,contact,target};
}

// Neutral-surface cross-section, in mm, centred at the bend. Offsetting by the
// surface normal supplies a continuous finite-thickness sheet for display/CAD.
export function sheetSection(c,beta){
  const r=insideRadius(c)+c.thickness/2,a=Math.max(0,beta),arc=r*a;
  const at=t=>({z:r*Math.sin(t),y:r*(1-Math.cos(t)),t});
  const back=at(-a),front=at(a),points=[];
  points.push({z:back.z-(c.flange-arc)*Math.cos(a),y:back.y+(c.flange-arc)*Math.sin(a),t:-a});
  for(let i=0;i<=20;i++)points.push(at(-a+2*a*i/20));
  points.push({z:front.z+(c.depth-c.flange-arc)*Math.cos(a),y:front.y+(c.depth-c.flange-arc)*Math.sin(a),t:a});
  // At zero bend the arc collapses to one point; remove coincident vertices.
  return points.filter((p,i)=>i===0||Math.hypot(p.z-points[i-1].z,p.y-points[i-1].y)>1e-7);
}

export function createBrakeProcess(){
  const S={phase:'idle',run:false,paused:false,done:false,complete:false,y:0,beta:0,peak:0,force:0,t:0,alarm:null};let job=null,dwell=0;
  const safetyError=s=>s.estop?'Núdzový STOP / Emergency STOP':!s.hydraulic?'Zapni hydrauliku. / Enable hydraulics.':s.guardOpen?'Zatvor bočné kryty. / Close side guards.':s.obstructed?'Prekážka v ochrannom poli. / Safety field obstructed.':s.unclamped?'Vráť plech k nástroju. / Return sheet to tooling.':null;
  const stop=alarm=>{S.run=false;S.paused=!!job&&!S.done;S.alarm=alarm||null;};
  const start=(c,s)=>{
    const error=safetyError(s);if(error){stop(error);return false;}
    if(S.done){stop('Vlož nový plech. / Load a new sheet.');return false;}
    if(!job){try{job={...c,...brakeSetup(c)};}catch(e){stop(e.message);return false;}S.phase='approach';}
    S.run=true;S.paused=false;S.alarm=null;return true;
  };
  const retract=s=>{if(s.estop||!s.hydraulic||s.unclamped){stop(safetyError(s));return false;}if(!job||S.y===0)return false;S.phase='return';S.run=true;S.paused=false;S.alarm=null;return true;};
  const reset=()=>{if(S.run||S.y>.01)return false;job=null;dwell=0;Object.assign(S,{phase:'idle',paused:false,done:false,complete:false,y:0,beta:0,peak:0,force:0,t:0,alarm:null});return true;};
  const advance=(dt,s)=>{
    if(!S.run)return;
    const err=safetyError(s);if(err){stop(err);return;}
    let remain=Math.max(0,Math.min(120,dt));
    while(remain>1e-8&&S.run){
      const h=Math.min(.02,remain);remain-=h;S.t+=h;
      if(S.phase==='approach'){
        S.y=Math.min(job.contact,S.y+80*h);if(S.y===job.contact)S.phase='bend';
      }else if(S.phase==='bend'){
        S.y=Math.min(job.target,S.y+8*h);let lo=0,hi=job.beta;
        for(let i=0;i<25;i++){const b=(lo+hi)/2;if(supportDepth(job,b)<S.y-job.contact)lo=b;else hi=b;}
        S.beta=(lo+hi)/2;S.peak=Math.max(S.peak,S.beta);S.force=job.force*Math.sin(S.beta)/Math.sin(job.beta);
        if(S.y===job.target){S.beta=job.beta;S.peak=job.beta;S.complete=true;S.phase='dwell';dwell=0;}
      }else if(S.phase==='dwell'){dwell+=h;if(dwell>=.8)S.phase='return';}
      else if(S.phase==='return'){
        S.y=Math.max(0,S.y-100*h);S.force=0;
        const release=Math.min(1,Math.max(0,(job.contact+supportDepth(job,S.peak)-S.y)/5));
        S.beta=Math.max(0,S.peak-release*job.spring*rad/2);
        if(S.y===0){S.run=false;S.paused=false;S.done=true;S.phase='done';}
      }
    }
  };
  return {S,start,hold:()=>stop(),retract,reset,advance,get job(){return job;}};
}
