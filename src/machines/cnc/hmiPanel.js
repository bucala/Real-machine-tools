import * as THREE from 'three';

// Shared 3D / full-screen control positions on the 6.04 × 4.7 keyboard plate.
export const HMI_CONTROL_LAYOUT={
  width:6.04,depth:4.7,
  brand:{x:.50,z:3.58,width:.95,height:.20},
  buttons:{emergency:{x:-2.62,z:4.1,r:.25},hold:{x:.72,z:3.95,r:.19},start:{x:.72,z:4.45,r:.19}},
  dials:{feed:{x:1.35,z:3.95,r:.21},rapid:{x:1.35,z:4.45,r:.21}},
  selector:{x:-2.65,z:2.4,r:.21},keySwitch:{x:-2.65,z:2.9,r:.15},
  blank:{x:-2.65,z:3.42,r:.13},trackball:{x:2.45,z:4.16,r:.27},
};
export const HMI_MONITOR_LAYOUT={width:6.2,height:4.72,screen:{x:0,y:2.45,width:5.18,height:3.46},keys:[
  ...Array.from({length:10},(_,i)=>({x:-2.88,y:.88+i*.34,width:.15,height:.16})),
  ...Array.from({length:13},(_,i)=>({x:-2.65+i*.435,y:.3,width:.17,height:.15})),
]};
export function drawHmiBrand(g,x,y,w,h,brand='HERMLE'){
  g.save();g.translate(x-w/2,y-h/2);g.fillStyle='#485057';g.strokeStyle='#485057';g.lineWidth=h*.13;
  if(brand.toUpperCase()==='HERMLE'){
    g.beginPath();g.arc(h*.48,h*.5,h*.38,.25,Math.PI*2-.25);g.stroke();g.fillRect(0,h*.44,h*.23,h*.15);
    g.font=`italic bold ${h*.72}px sans-serif`;g.textAlign='left';g.textBaseline='middle';g.fillText('HERMLE',h*.95,h*.54,w-h);
  }else{g.font=`bold ${h*.72}px sans-serif`;g.textAlign='center';g.textBaseline='middle';g.fillText(brand,w/2,h/2,w);}
  g.restore();
}
export function hmiKeyLayout(){
  const keys=[];
  const key=(x,z,w,d,label='',mat='white',control=null)=>keys.push({x,z,w,d,label,mat,control});
  const qwerty=['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];
  qwerty.forEach((row,r)=>[...row].forEach((label,i)=>key(-2.58+i*.345+(r%2)*.1,.48+r*.34,.3,.25,label)));
  for(let i=0;i<11;i++)key(-2.58+i*.32,1.5,.27,.23,String(i%10));
  key(-1.25,1.82,1.8,.22,'');
  // Axis/navigation bank to the right, with the orange axis keys in their own column.
  for(let r=0;r<5;r++)for(let c=0;c<3;c++)key(1.48+c*.39,.48+r*.34,.32,.26,c===0?['X','Y','Z','IV','V'][r]:String((r*2+c)%10),c===0?'orange':'dark');
  const banks=[['PGM','MGT','MOD','TOOL','DEF','CALL'],['L','C','CR','CT','RND','CHF'],['CYCL','DEF','CALL','LBL','SET','CALL'],['↑','ENT','NO','←','↓','→']];
  for(const [i,[x,z]] of [[-1.7,2.4],[-.05,2.4],[-1.7,3.02],[-.05,3.02]].entries())for(let r=0;r<2;r++)for(let c=0;c<3;c++)key(x+c*.35,z+r*.3,.29,.22,banks[i][r*3+c]);
  for(let r=0;r<3;r++)for(let c=0;c<4;c++)key(1.05+c*.38,2.35+r*.3,.3,.22,['CE','7','8','9','4','5','6','−','1','2','3','+'][r*4+c],r===0&&c===0?'orange':'dark');
  // Machine keypad along the front edge, leaving the emergency stop and knobs clear.
  for(let r=0;r<2;r++)for(let c=0;c<8;c++)key(-1.9+c*.32,3.94+r*.28,.27,.22,r===0&&c<4?['R','L','SBL','KSS'][c]:'',r===0&&c<2?'dark':'white',r===0&&c<4?['reset','light','single','coolant'][c]:null);
  return keys;
}

// Console geometry follows the TNC photograph: landscape monitor, sloping full-depth
// keyboard plate, separate lower housing and red grab rails outside the enclosure.
export function createHmiPanel(parent, M, tex, {brand='HERMLE'}={}) {
  const box=(g,x,y,z,w,h,d,mat=M.brush)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
  const cyl=(g,x,y,z,r,h,mat=M.black)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24),mat);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
  const line=(g,a,b,r,mat)=>{const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),delta=q.clone().sub(p);const o=cyl(g,0,0,0,r,delta.length(),mat);o.position.copy(p).add(q).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return o;};
  const color=(hex)=>new THREE.MeshStandardMaterial({color:new THREE.Color(hex).convertSRGBToLinear(),roughness:.5,metalness:.12});
  const capMaterials={white:color(0xd8dcde),dark:color(0x34383a),orange:color(0xde9362)};
  const depth=4.7, slope=20*Math.PI/180, rearY=12.5, rearZ=-1.6;
  const frontY=rearY-depth*Math.sin(slope), frontZ=rearZ+depth*Math.cos(slope);
  const profile=new THREE.Shape();profile.moveTo(rearZ,9.7);profile.lineTo(frontZ,9.7);profile.lineTo(frontZ,frontY);profile.lineTo(rearZ,rearY);profile.closePath();
  const body=new THREE.Mesh(new THREE.ExtrudeGeometry(profile,{depth:6.2,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:1}),M.cab2);
  body.name='console-housing';body.rotation.y=-Math.PI/2;body.position.x=3.1;body.castShadow=true;parent.add(body);
  // Recessed drawer and lower fascia, with a real open hand recess.
  box(parent,0,10.12,frontZ+.035,5.6,.65,.08,M.steelD);
  box(parent,0,10.15,frontZ+.09,5.38,.45,.08,M.cab2);
  box(parent,-1.65,9.78,frontZ+.09,2,.15,.08,M.brush);box(parent,1.65,9.78,frontZ+.09,2,.15,.08,M.brush);
  box(parent,0,9.84,frontZ+.095,1.15,.22,.08,M.black);
  box(parent,0,9.55,0,1.65,.3,1.45,M.steelD); // mounting flange meets the terminal post

  const deck=new THREE.Group();deck.name='keyboard-deck';deck.position.set(0,rearY,rearZ);deck.rotation.x=slope;parent.add(deck);
  box(deck,0,.035,depth/2,6.04,.07,depth-.1,M.brush);
  const keys=hmiKeyLayout(), controls={buttons:{},knobs:{}};
  const instances={};
  for(const [name,mat] of Object.entries(capMaterials)){
    const list=keys.filter(k=>k.mat===name&&!k.control), mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),mat,list.length);mesh.name=`keycaps-${name}`;
    list.forEach((k,i)=>{const m=new THREE.Matrix4().compose(new THREE.Vector3(k.x,.12,k.z),new THREE.Quaternion(),new THREE.Vector3(k.w,.1,k.d));mesh.setMatrixAt(i,m);});mesh.castShadow=true;deck.add(mesh);instances[name]=mesh;
  }
  for(const k of keys.filter(k=>k.control)){
    const g=new THREE.Group();g.position.set(k.x,0,k.z);deck.add(g);
    box(g,0,.12,0,k.w,.1,k.d,capMaterials[k.mat]);controls.buttons[k.control]=g;
  }
  if(tex){
    const labels=tex(960,720,(g,w,h)=>{
      g.clearRect(0,0,w,h);g.textAlign='center';g.textBaseline='middle';g.font='15px sans-serif';
      for(const k of keys){g.fillStyle=k.mat==='dark'?'#e8ecee':'#262b30';g.font=`${k.label.length>2?9:15}px sans-serif`;g.fillText(k.label,(k.x/6.04+.5)*w,k.z/depth*h);}
      const brandPos=HMI_CONTROL_LAYOUT.brand;
      drawHmiBrand(g,(brandPos.x/HMI_CONTROL_LAYOUT.width+.5)*w,brandPos.z/HMI_CONTROL_LAYOUT.depth*h,brandPos.width/HMI_CONTROL_LAYOUT.width*w,brandPos.height/HMI_CONTROL_LAYOUT.depth*h,brand);
      g.strokeStyle='#485057';g.lineWidth=1.5;
      for(const [id,p] of Object.entries(HMI_CONTROL_LAYOUT.dials)){
        for(let i=0;i<=10;i++){
          const a=(-140+i*28)*Math.PI/180,px=(p.x/6.04+.5)*w,pz=p.z/depth*h;
          g.beginPath();g.moveTo(px+Math.sin(a)*.25*w/6.04,pz-Math.cos(a)*.25*h/depth);g.lineTo(px+Math.sin(a)*.29*w/6.04,pz-Math.cos(a)*.29*h/depth);g.stroke();
        }
        g.font='10px sans-serif';g.fillStyle='#34383a';g.fillText(id==='feed'?'F %':'F MAX',(p.x/6.04+.5)*w,(p.z+.32)/depth*h);
      }
    });
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(6.04,depth),new THREE.MeshBasicMaterial({map:labels.tx,transparent:true,depthWrite:false,toneMapped:false}));plane.userData.controlPassThrough=true;plane.rotation.x=-Math.PI/2;plane.position.set(0,.175,depth/2);deck.add(plane);
  }
  const knob=(x,z,id)=>{const g=new THREE.Group();g.position.set(x,0,z);deck.add(g);cyl(g,0,.11,0,.21,.08,M.steelD);cyl(g,0,.25,0,.15,.24,M.black);box(g,0,.38,0,.04,.025,.19,M.cab);if(id)controls.knobs[id]=g;};
  knob(HMI_CONTROL_LAYOUT.selector.x,HMI_CONTROL_LAYOUT.selector.z);for(const [id,p] of Object.entries(HMI_CONTROL_LAYOUT.dials))knob(p.x,p.z,id);
  // Mushroom stop, two illuminated machine buttons and trackball, all normal to the deck.
  const stop=HMI_CONTROL_LAYOUT.buttons.emergency;
  cyl(deck,stop.x,.12,stop.z,.25,.12,M.yellow);controls.buttons.emergency=cyl(deck,stop.x,.28,stop.z,.16,.22,M.red);
  for(const id of ['hold','start']){const {x,z}=HMI_CONTROL_LAYOUT.buttons[id];cyl(deck,x,.12,z,.19,.09,M.steel);controls.buttons[id]=cyl(deck,x,.18,z,.14,.04,id==='hold'?M.red:color(0x258c6a));}
  const track=HMI_CONTROL_LAYOUT.trackball;cyl(deck,track.x,.1,track.z,track.r,.07,M.steelD);const ball=new THREE.Mesh(new THREE.SphereGeometry(.2,24,12),M.black);ball.position.set(track.x,.13,track.z);deck.add(ball);
  const ks=HMI_CONTROL_LAYOUT.keySwitch;cyl(deck,ks.x,.13,ks.z,ks.r,.12,M.steelD);box(deck,ks.x,.28,ks.z,.06,.25,.08,M.black);
  const blank=HMI_CONTROL_LAYOUT.blank;cyl(deck,blank.x,.09,blank.z,blank.r,.025,M.steel);
  for(const x of [-2.85,2.85])for(const z of [.17,4.5])cyl(deck,x,.09,z,.055,.025,M.steelD);

  const monitor=new THREE.Group();monitor.name='monitor';monitor.position.set(0,rearY+.04,rearZ-.04);monitor.rotation.x=-8*Math.PI/180;parent.add(monitor);
  box(monitor,0,2.36,-.24,6.2,4.72,.48,M.brush);
  box(monitor,0,2.36,-.49,5.94,4.45,.08,M.cab2).name='HMI-monitor-rear-cover';
  for(const y of [.65,.83,1.01,3.75,3.93,4.11])box(monitor,0,y,-.538,3.8,.065,.015,M.black);
  box(monitor,0,2.44,.015,5.72,4.07,.035,M.black);
  const screen=HMI_MONITOR_LAYOUT.screen;const display=new THREE.Mesh(new THREE.PlaneGeometry(screen.width,screen.height),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}));display.position.set(screen.x,screen.y,.045);monitor.add(display);
  for(const key of HMI_MONITOR_LAYOUT.keys)box(monitor,key.x,key.y,.06,key.width,key.height,.08,capMaterials.dark);
  if(tex){
    const mark=tex(768,96,(g,w,h)=>{g.clearRect(0,0,w,h);g.fillStyle='#40474b';g.font='bold 36px sans-serif';g.textBaseline='middle';g.fillText('HEIDENHAIN',20,h/2);g.textAlign='right';g.font='30px sans-serif';g.fillText('TNC 640',w-20,h/2);});
    const badge=new THREE.Mesh(new THREE.PlaneGeometry(5.7,.24),new THREE.MeshBasicMaterial({map:mark.tx,transparent:true,depthWrite:false,toneMapped:false}));
    badge.name='HMI-controller-marking';badge.position.set(0,4.57,.025);monitor.add(badge);
  }
  for(const x of [-2.94,2.94])for(const y of [.18,4.55]){const screw=cyl(monitor,x,y,.04,.045,.025,M.steelD);screw.rotation.x=Math.PI/2;}
  // Two independent side tubes, open across the front. The close-up shows flat
  // black end plugs, a rounded monitor/deck bend and separate black stand-offs.
  for(const s of [-1,1]){
    const x=s*3.32,rear=new THREE.Vector3(x,rearY+.05,rearZ),top=new THREE.Vector3(x,rearY+.04+4.72*Math.cos(8*Math.PI/180),rearZ-.04-4.72*Math.sin(8*Math.PI/180)),front=new THREE.Vector3(x,frontY+.01,frontZ+.36);
    const incoming=rear.clone().sub(front).normalize(),outgoing=top.clone().sub(rear).normalize();
    const a=rear.clone().addScaledVector(incoming,-.23),b=rear.clone().addScaledVector(outgoing,.23),path=new THREE.CurvePath();
    path.add(new THREE.LineCurve3(front,a));path.add(new THREE.QuadraticBezierCurve3(a,rear,b));path.add(new THREE.LineCurve3(b,top));
    const tube=new THREE.Mesh(new THREE.TubeGeometry(path,64,.115,12,false),M.red);tube.name=s<0?'HMI-left-side-tube':'HMI-right-side-tube';tube.castShadow=true;parent.add(tube);
    for(const [end,direction] of [[front,incoming.clone().negate()],[top,outgoing]]){
      const cap=line(parent,end.toArray(),end.clone().addScaledVector(direction,.055).toArray(),.116,M.black);cap.name='HMI-tube-end-plug';
    }
    for(const t of [.14,.91]){const p=rear.clone().lerp(top,t);box(parent,x-s*.13,p.y,p.z,.32,.18,.24,M.black);}
    for(const t of [.2,.83]){const p=rear.clone().lerp(front,t);box(parent,x-s*.13,p.y-.1,p.z,.38,.2,.28,M.black);}
  }
  // Low, elongated hand controller hangs parallel to the right tube, rather
  // than standing upright like a second monitor. Its photographed face has keys,
  // not the invented LCD of the previous approximation.
  const pendant=new THREE.Group();pendant.name='handheld-pendant';pendant.position.set(3.57,10.3,.9);pendant.rotation.y=Math.PI/2;pendant.rotation.z=slope;parent.add(pendant);
  const outline=new THREE.Shape();[[-1.58,-.52],[-1.43,-.7],[1.36,-.7],[1.58,-.46],[1.58,.48],[1.4,.7],[-1.42,.7],[-1.58,.53]].forEach(([x,y],i)=>i?outline.lineTo(x,y):outline.moveTo(x,y));outline.closePath();
  const housing=new THREE.Mesh(new THREE.ExtrudeGeometry(outline,{depth:.38,bevelEnabled:true,bevelSize:.06,bevelThickness:.05,bevelSegments:3}),M.black);housing.position.z=-.22;housing.name='pendant-moulded-housing';housing.castShadow=true;pendant.add(housing);
  box(pendant,0,0,.2,2.89,1.21,.035,capMaterials.dark).name='pendant-keypad-face';
  for(const x of [-1.34,1.34])for(const y of [-.53,.53]){const screw=cyl(pendant,x,y,.235,.035,.02,M.steelD);screw.rotation.x=Math.PI/2;}
  const pendantKeys=[],green=color(0x398b6e);
  for(let row=0;row<3;row++)for(let col=0;col<5;col++){
    const orange=(row===0&&col>=2)||(row===2&&col>=3),isGreen=col===0&&row!==1;
    const key={x:-1.04+col*.52,y:.4-row*.4,label:orange?(row===0?['X','Y','Z'][col-2]:['IV','V'][col-3]):isGreen?(row===0?'I':'O'):['+','−','•'][row]};
    const cap=box(pendant,key.x,key.y,.26,.34,.29,.07,orange?capMaterials.orange:isGreen?green:capMaterials.dark);cap.name='pendant-keycap';pendantKeys.push(key);
  }
  if(tex){
    const legends=tex(768,336,(g,w,h)=>{g.clearRect(0,0,w,h);g.strokeStyle='#b5bec4';g.fillStyle='#d4dcdf';g.font='26px sans-serif';g.textAlign='center';g.textBaseline='middle';for(const k of pendantKeys){const x=(k.x/2.89+.5)*w,y=(.5-k.y/1.21)*h;g.strokeRect(x-.14/2.89*w,y-.12/1.21*h,.28/2.89*w,.24/1.21*h);g.fillText(k.label,x,y);}});
    const face=new THREE.Mesh(new THREE.PlaneGeometry(2.89,1.21),new THREE.MeshBasicMaterial({map:legends.tx,transparent:true,depthWrite:false,toneMapped:false}));face.position.z=.302;pendant.add(face);
  }
  const hanger=box(pendant,0,.83,-.12,2.1,.22,.3,M.black);hanger.name='pendant-rail-hanger';
  for(const x of [-.8,.8])box(pendant,x,.62,-.24,.18,.5,.2,M.black);
  const connector=line(pendant,[-1.55,-.08,-.02],[-2.03,-.08,-.02],.15,M.black);connector.name='pendant-cable-connector';
  for(let i=0;i<5;i++)line(pendant,[-1.63-i*.07,-.08,-.02],[-1.66-i*.07,-.08,-.02],.175,M.black);
  pendant.updateMatrix();
  const start=new THREE.Vector3(-2.05,-.08,-.02).applyMatrix4(pendant.matrix),coilX=start.x+.16,coilY=start.y-.55,coilZ=start.z+.06;
  const cablePoints=[start,new THREE.Vector3(coilX,coilY+.24,coilZ)];
  for(let i=0;i<=192;i++){const a=i/192*Math.PI*24;cablePoints.push(new THREE.Vector3(coilX+.17*Math.cos(a),coilY-i/192*1.68,coilZ+.17*Math.sin(a)));}
  cablePoints.push(new THREE.Vector3(3.5,6.75,2.1),new THREE.Vector3(2.6,7.15,.8),new THREE.Vector3(1,9.55,0));
  const cable=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePoints),320,.045,8,false),M.black);cable.name='pendant-coiled-cable';parent.add(cable);
  return {display,deck,monitor,body,instances,keys,controls,frontY,frontZ};
}
