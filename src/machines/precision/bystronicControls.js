import * as THREE from 'three';

// Photo reconstruction: swept orange/grey terminal pedestal and the separate
// silver/orange operator station. Control caps stay separate for picking/CAD.
export function createBystronicControls({part,kit,M,tex}){
  const {group,box,cyl,rod,label}=kit;
  const profile=(p,name,points,width,mat,x=0)=>{
    const shape=new THREE.Shape(),vertices=points.map(([z,y])=>new THREE.Vector2(-z,y));
    vertices.forEach((v,i)=>{const a=vertices[(i+vertices.length-1)%vertices.length],b=vertices[(i+1)%vertices.length],r=Math.min(.18,v.distanceTo(a)*.25,v.distanceTo(b)*.25),before=v.clone().add(a.clone().sub(v).normalize().multiplyScalar(r)),after=v.clone().add(b.clone().sub(v).normalize().multiplyScalar(r));if(i)shape.lineTo(before.x,before.y);else shape.moveTo(before.x,before.y);shape.quadraticCurveTo(v.x,v.y,after.x,after.y);});shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:false});geo.translate(0,0,-width/2);geo.rotateY(Math.PI/2);
    const mesh=new THREE.Mesh(geo,mat);mesh.position.x=x;mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;p.add(mesh);return mesh;
  };
  const cable=(p,pts,r=.05)=>{const curve=new THREE.CatmullRomCurve3(pts.map(v=>new THREE.Vector3(...v))),o=new THREE.Mesh(new THREE.TubeGeometry(curve,40,r,8,false),M.black);o.name='control-cable';p.add(o);};
  const controls={buttons:{}},indicators=[];
  const button=(p,id,x,y,z,text,material=M.cab)=>{
    cyl(p,x,y,z,.16,.05,M.steelD,'z');
    const cap=group(id+'-button',p);cap.position.set(x,y,z+.045);cap.userData.pressAxis='z';
    cyl(cap,0,0,0,.125,.055,material,'z');if(text)label(cap,text,0,0,.031,.2,.1,{color:'#38434a',background:'#d7dcdd',size:70});
    controls.buttons[id]=cap;return cap;
  };
  const panel=part('panel'),consolePivot=group('mobile-touch-console',panel);consolePivot.position.set(29.2,0,13);
  box(consolePivot,0,.34,0,5.5,.18,4.7,M.dark);
  for(const x of [-2.25,2.25])for(const z of [-1.85,1.85]){
    cyl(consolePivot,x,.15,z,.32,.26,M.black);cyl(consolePivot,x,.48,z,.24,.08,M.red);cyl(consolePivot,x,.54,z,.065,.05,M.steel);
  }
  const spine=[[-.6,.45],[.35,.45],[.1,2.6],[-.5,6.5],[-.55,8.1],[-.2,9.8],[.45,11.2],[-.2,11.7],[-1.05,10],[-1.35,8.2],[-1.3,6.5],[-.7,2.5]];
  profile(consolePivot,'curved-terminal-spine',spine,1.25,M.anth);
  for(const x of [-.78,.78]){
    profile(consolePivot,'white-terminal-edge',spine,.2,M.cab,x);
    profile(consolePivot,'orange-terminal-cheek',spine,.11,M.red,x+Math.sign(x)*.13);
  }
  box(consolePivot,0,8.05,1.1,5.4,.11,2.4,M.anth);rod(consolePivot,[-.7,7.75,.1],[-.7,8.0,1.5],.06,M.steel);rod(consolePivot,[.7,7.75,.1],[.7,8.0,1.5],.06,M.steel);
  button(consolePivot,'hydraulic',0,9.2,-.22,'I');button(consolePivot,'light',0,8.7,-.36,'☼');
  for(const [key,y,z] of [['hydraulic',9.2,-.17],['light',8.7,-.31]]){const m=cyl(consolePivot,.32,y,z,.055,.035,M.green.clone(),'z');indicators.push({key,mesh:m});}
  // Articulated monitor, black bezel, silver shell and open lower grab rail.
  const monitor=group('touchscreen-tilt-bracket',consolePivot);monitor.position.set(0,11.1,.8);monitor.rotation.x=-.2;
  box(monitor,0,1.05,-.15,8.05,4.95,.3,M.cab);box(monitor,0,1.15,.05,7.8,4.55,.12,M.black);
  const display=new THREE.Mesh(new THREE.PlaneGeometry(7.35,4.28),new THREE.MeshBasicMaterial({toneMapped:false}));display.position.set(0,1.15,.12);display.name='live-HMI-touch-display';monitor.add(display);
  box(monitor,0,1.05,-.4,4,2.5,.3,M.dark);cyl(monitor,0,.1,-.68,.3,2.4,M.steelD,'x');box(consolePivot,0,10.9,-.2,1.6,.45,2.2,M.steelD);
  for(const x of [-3.9,3.9])box(monitor,x,-1.66,-.02,.14,1.0,.2,M.cab);box(monitor,0,-2.1,-.02,7.95,.14,.2,M.cab);
  label(monitor,'Bystronic',-2.8,-1.06,.13,1.25,.17,{color:'#dce1e3',background:'#14171b',size:90});
  for(const x of [-1.4,1.4])for(const y of [.25,1.8])cyl(monitor,x,y,-.58,.055,.05,M.steel,'z');
  for(let i=0;i<12;i++)box(monitor,-2+i*.36,2.9,-.35,.16,.035,.05,M.black);
  cable(consolePivot,[[0,10.8,-1.5],[.5,9.8,-1.9],[.6,8,-1.8],[.4,3,-.9],[.3,.4,-.2]]);
  cable(panel,[[29.5,.3,13],[33,.18,11],[34,.16,6],[28,.15,5],[25,.5,0]],.055);
  // The operator face is tilted towards the user. The STOP mushroom is here,
  // surrounded by a yellow collar, rather than floating below the HMI screen.
  const pedal=part('pedal');pedal.position.set(12,0,14);
  const stem=[[-.6,.35],[.45,.35],[-.35,5.8],[-.25,6.5],[.8,7.6],[-.6,10.05],[-1.2,9.75],[-1.7,8.9],[-.9,6.6],[-1.25,5.8]];
  // Separate bent side rails leave the centre open down to the foot enclosure.
  for(const x of [-.9,.9]){
    profile(pedal,'open-operator-side-rail',stem,.32,M.cab,x);
    profile(pedal,'orange-operator-side',stem,.055,M.red,x+Math.sign(x)*.18);
  }
  box(pedal,0,.65,.1,1.85,.16,.65,M.steelD);
  box(pedal,0,.38,.8,2.8,.32,2.7,M.anth);
  const operatorFace=group('inclined-STOP-control-face',pedal);operatorFace.position.set(0,8.65,.5);operatorFace.rotation.x=-.45;
  const faceShape=new THREE.Shape();faceShape.moveTo(-1.125,-1.525);faceShape.lineTo(1.125,-1.525);faceShape.lineTo(1.125,1.525);faceShape.lineTo(-1.125,1.525);faceShape.closePath();
  const gripHole=new THREE.Path();gripHole.moveTo(-.78,-1.37);gripHole.lineTo(-.78,-.94);gripHole.lineTo(.78,-.94);gripHole.lineTo(.78,-1.37);gripHole.closePath();faceShape.holes.push(gripHole);
  const faceGeo=new THREE.ExtrudeGeometry(faceShape,{depth:.12,bevelEnabled:false});faceGeo.translate(0,0,-.06);const faceMesh=new THREE.Mesh(faceGeo,M.steelD);faceMesh.name='operator-face-with-open-hand-grip';operatorFace.add(faceMesh);
  for(const x of [-1.14,1.14])box(operatorFace,x,0,.04,.08,3.2,.18,M.cab);
  const layout=[['hold',-.65,.93,'Ⅱ'],['acknowledge',0,.93,'ACK'],['reset',.65,.93,'NEW'],['startPanel',-.65,.35,'▼'],['retractPanel',.65,.35,'▲']];
  for(const [id,x,y,text] of layout)button(operatorFace,id,x,y,.09,text);
  cyl(operatorFace,0,-.35,.105,.29,.06,M.yellow,'z');
  const stop=group('latching-emergency-STOP',operatorFace);stop.position.set(0,-.35,.16);stop.userData.pressAxis='z';
  cyl(stop,0,0,.015,.13,.12,M.dark,'z');cyl(stop,0,0,.12,.22,.12,M.red,'z');cyl(stop,0,0,.19,.19,.025,M.red,'z');controls.buttons.emergency=stop;
  label(stop,'↻',0,0,.207,.26,.18,{color:'#fff',background:'#f44d34',size:90});
  label(operatorFace,'STOP',0,-.82,.075,.48,.16,{color:'#fff',background:'#737e86',size:100});
  for(const x of [-.82,.82])rod(operatorFace,[x,-1.4,.04],[x,-1.4,.3],.075,M.steel);
  rod(operatorFace,[-.82,-1.4,.3],[.82,-1.4,.3],.1,M.steel);
  for(const x of [-1,1])for(const y of [-1.38,1.38])cyl(operatorFace,x,y,.09,.035,.04,M.steel,'z');
  // Two independent foot pads under a protective hood, with front access.
  for(const x of [-1.32,1.32])box(pedal,x,.84,1,.14,.84,2.4,M.anth);box(pedal,0,1.22,.7,2.8,.13,1.8,M.anth);
  for(const [id,x] of [['start',-.62],['retract',.62]]){
    const pad=group(id+'-foot-pad',pedal);pad.position.set(x,.62,1.35);pad.userData.pressAxis='y';controls.buttons[id]=pad;
    box(pad,0,0,0,.95,.12,1.8,M.steelD);for(let i=0;i<9;i++)box(pad,0,.07,-.7+i*.17,.85,.035,.035,M.black);
  }
  cable(pedal,[[0,.5,-.45],[.5,.2,-.7],[2,.15,-.8],[4,.15,-2],[6,.3,-8]],.06);cyl(pedal,0,.5,-.48,.12,.24,M.black,'z');
  return {panel,pedal,consolePivot,monitor,display,operatorFace,controls,indicators};
}
