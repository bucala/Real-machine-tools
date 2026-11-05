import * as THREE from 'three';

// C42 layout, in 100 mm units: cabin 2450 mm, conveyor reach 1710 mm,
// ICS footprint 1110 × 1630 mm, recooler 740 × 950 mm. C32 scales by cabin width.
export function createAccessories(parent, M, scale, halfWidth = 11.4 * scale) {
  const equipment = {}, k = halfWidth / 12.25;
  const housing=M.cab2.clone();housing.color.setHex(0x626a6e).convertSRGBToLinear();
  const group = (name) => { const g=new THREE.Group(); g.name=name; g.scale.setScalar(k); parent.add(g); equipment[name]=g; return g; };
  const box=(g,x,y,z,w,h,d,m=housing)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;};
  const cyl=(g,x,y,z,r,h,m=M.steelD)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24),m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
  const link=(g,a,b,w,d,m=housing)=>{const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),v=q.clone().sub(p);const o=box(g,0,0,0,w,v.length(),d,m);o.position.copy(p).add(q).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return o;};
  const hose=(g,pts,r=.12)=>{g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p))),24,r,8,false),M.black));};
  const wheels=(g,x,z,w,d)=>{for(const dx of [-w/2,w/2])for(const dz of [-d/2,d/2]){box(g,x+dx,.65,z+dz,.15,.35,.35,M.steel);cyl(g,x+dx,.32,z+dz,.27,.2,M.black).rotation.z=Math.PI/2;}};
  const profile=(g,points,z,depth,mat=housing)=>{
    const sh=new THREE.Shape();points.forEach(([x,y],i)=>i?sh.lineTo(x,y):sh.moveTo(x,y));sh.closePath();
    const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth,bevelEnabled:false}),mat);mesh.position.z=z;mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;
  };
  const rod=(g,a,b,r,mat=M.steelD)=>{const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),d=q.clone().sub(p),mesh=cyl(g,0,0,0,r,d.length(),mat);mesh.position.copy(p).add(q).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return mesh;};
  const fasteners=(g,points)=>{const mesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(.045,.045,.035,6),M.steelD,points.length),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);points.forEach((p,i)=>mesh.setMatrixAt(i,new THREE.Matrix4().compose(new THREE.Vector3(...p),q,new THREE.Vector3(1,1,1))));g.add(mesh);};
  // Low chip pan runs along X under the bed; its handle belongs on the
  // outboard end, not on a tall strip across the front corner of the enclosure.
  const drawer=new THREE.Group();drawer.name='pull-out-chip-pan';drawer.scale.setScalar(k);parent.add(drawer);
  const panOuter=-19.05,panInner=-7.4,panZ=5.7,panDepth=4.4;
  box(drawer,(panOuter+panInner)/2,1.17,panZ,panInner-panOuter,.14,panDepth,M.steelD);
  for(const z of [panZ-panDepth/2,panZ+panDepth/2]){
    box(drawer,(panOuter+panInner)/2,1.75,z,panInner-panOuter,1.2,.12,housing);
    box(drawer,(panOuter+panInner)/2,2.4,z,panInner-panOuter,.12,.2,M.steel);
  }
  for(const x of [panOuter,panInner])box(drawer,x,1.75,panZ,.12,1.2,panDepth,housing);
  box(drawer,panOuter-.16,1.85,panZ,.12,.13,1.55,M.black);
  for(const z of [panZ-.65,panZ+.65])box(drawer,panOuter-.1,1.85,z,.15,.18,.16,M.steelD);
  // Rollers stay with the pan, the support rails stay bolted to the base.
  for(const x of [panOuter+.8,panInner-.8])for(const z of [panZ-1.8,panZ+1.8]){
    const wheel=cyl(drawer,x,.72,z,.32,.18,M.black);wheel.rotation.x=Math.PI/2;
  }
  const panRails=new THREE.Group();panRails.name='chip-pan-guide-rails';panRails.scale.setScalar(k);parent.add(panRails);
  for(const z of [panZ-2,panZ+2])box(panRails,-12.8,.88,z,13.2,.18,.2,M.steelD);
  const chipPan={object:drawer,open:false,amount:0,travel:17*k};
  const conveyor=group('conveyor'), flights=[];
  // Enclosed hinge-belt conveyor, folded side sheets and a continuous rising hood.
  const cheek=[[-12.1,1.1],[-17.2,1.1],[-24.2,8.2],[-26.35,8.8],[-26.35,10],[-24.9,10.8],[-23.5,10.65],[-16.1,3.05],[-12.1,3.05]];
  for(const z of [4.7,8.15]){
    const side=profile(conveyor,cheek,z,.13);side.name='conveyor-folded-side';
    fasteners(conveyor,[[-13,2.4,z+.14],[-16,2.3,z+.14],[-19.5,5,z+.14],[-23.8,9.4,z+.14]]);
  }
  box(conveyor,-14.1,1.15,6.5,4.1,.18,3.5);
  link(conveyor,[-16.3,1.4,6.5],[-24.3,8.5,6.5],.18,3.5);
  const belt=link(conveyor,[-16.05,2.9,6.5],[-24.25,9.4,6.5],.12,2.9,M.dark);
  for(let i=0;i<14;i++)flights.push(box(conveyor,0,0,0,.15,.18,2.75,M.steelD));
  link(conveyor,[-16.1,3.12,6.5],[-23.55,10.7,6.5],.16,3.5);
  box(conveyor,-14.1,3.12,6.5,4,.14,3.5);
  const hood=new THREE.Group();hood.name='chip-conveyor-discharge-hood';conveyor.add(hood);
  // Cantilevered rectangular canopy over the cart, with an open downward throat.
  box(hood,-26.9,10.85,6.5,5.1,.16,3.75,M.dark);
  for(const z of [4.63,8.24])box(hood,-26.9,10.2,z,5.1,1.3,.14);
  box(hood,-29.4,10.2,6.5,.14,1.3,3.75);
  box(hood,-24.4,10.15,6.5,.14,1.3,3.75);
  for(const z of [5.1,7.9])box(hood,-26,9.2,z,3.2,.9,.12);
  for(const x of [-27.6,-24.4])box(hood,x,9.2,6.5,.12,.9,2.8);
  for(const z of [5.02,8]){
    box(hood,-26,8.7,z,3.3,.45,.05,M.yellow);
    for(let i=0;i<6;i++)profile(hood,[[-27.6+i*.55,8.47],[-27.34+i*.55,8.47],[-27.56+i*.55,8.92],[-27.82+i*.55,8.92]],z+.03,.02,M.black);
  }
  // Gear motor at the foot of the inclined conveyor, separate from its head axle.
  box(conveyor,-17.1,2.0,3.7,1.5,1.35,1.4,M.steelD);
  cyl(conveyor,-17.1,3.5,3.7,.53,1.65,M.anth);cyl(conveyor,-17.1,4.4,3.7,.57,.2,M.steelD);
  for(let i=0;i<14;i++){const a=i*Math.PI/7;box(conveyor,-17.1+Math.cos(a)*.54,3.5,3.7+Math.sin(a)*.54,.07,1.5,.07,M.steelD);}
  hose(conveyor,[[-17.6,2.4,3.7],[-18,2.5,3.2],[-18.2,1.5,4.5]],.08);
  rod(conveyor,[-24.7,9.6,4.5],[-24.7,9.6,8.5],.18,M.steelD);
  for(const z of [4.9,8.1]){link(conveyor,[-20.4,.85,z],[-20.4,5,z],.22,.22,M.steelD);box(conveyor,-20.4,.8,z,.65,.15,.75,M.steelD);}
  wheels(conveyor,-20.4,6.5,.6,3.4);
  // Flared, open tipping cart. The lower nose is folded back, not a solid box.
  const cart=new THREE.Group();cart.name='chip-cart-chassis';cart.position.set(-26.55,0,6.5);conveyor.add(cart);
  for(const z of [-2.3,2.3])box(cart,0,.85,z,4.9,.35,.3,M.steelD);
  for(const x of [-2.25,2.25])box(cart,x,.85,0,.3,.35,4.9,M.steelD);
  wheels(cart,0,0,4.4,4.5);
  const bucket=new THREE.Group();bucket.name='open-tipping-chip-cart';bucket.position.y=2.15;cart.add(bucket);
  const outline=[[-2.8,5.35],[2.8,5.35],[1.95,.25],[-.8,-.55],[-2.8,2.05]];
  for(const z of [-2.85,2.72]){
    profile(bucket,outline,z,.13);fasteners(bucket,[[-2.55,4.9,z+.14],[2.5,4.9,z+.14],[1.7,.5,z+.14],[-.6,-.2,z+.14]]);
    box(bucket,0,5.39,z,5.7,.14,.2);
  }
  // Recessed darker inner liners make the open hopper readable in ambient light.
  for(const z of [-2.69,2.68])profile(bucket,outline,z,.02,M.dark);
  // Join the lower four contour segments; leave the entire top mouth open.
  for(let i=1;i<outline.length;i++){
    const a=outline[i],b=outline[(i+1)%outline.length];link(bucket,[a[0],a[1],0],[b[0],b[1],0],.12,5.7);link(bucket,[a[0]+.02,a[1]+.06,0],[b[0]+.02,b[1]+.06,0],.02,5.35,M.dark);
  }
  rod(cart,[0,2.15,-3.04],[0,2.15,3.04],.15,M.steelD);
  for(const z of [-2.95,2.95]){
    profile(cart,[[-.55,1],[.55,1],[.32,2.5],[-.32,2.5]],z,.12,M.steelD);
    rod(bucket,[-2.93,4.6,z],[-2.93,3.7,z],.08,M.black);
  }
  box(cart,-2.4,1.1,0,.18,.45,.7,M.red); // tipping latch
  const chipCart={object:bucket,open:false,amount:0};
  // Small yellow/red isolator on the discharge hood, as in the reference.
  box(hood,-26.43,10.12,6.5,.12,.38,.42,M.yellow);
  rod(hood,[-26.52,10,6.5],[-26.52,10.25,6.5],.065,M.red);

  const coolant=group('coolant');coolant.position.x=-2.8*k; // 900 mm service aisle to the cabinet
  // Broad low reservoir, removable lid and raised paper-filter module.
  box(coolant,-24,4.55,-9.4,11.1,7.5,16.3);
  box(coolant,-24,8.36,-9.4,11.2,.18,16.4,M.steelD);
  for(const z of [-17.5,-1.3])box(coolant,-24,8.65,z,11,.4,.13);
  for(const x of [-29.45,-18.55])box(coolant,x,8.65,-9.4,.13,.4,16.2);
  box(coolant,-24,4.7,-1.16,10.6,6.8,.08);
  fasteners(coolant,[[-29.1,1.6,-1.1],[-18.9,1.6,-1.1],[-29.1,7.9,-1.1],[-18.9,7.9,-1.1]]);
  box(coolant,-19.25,5.6,-1.04,.35,2.5,.1,M.black);
  box(coolant,-19.25,5.6,-.98,.13,2.1,.04,M.steel); // level gauge
  box(coolant,-23.2,9.1,-9.1,7.5,1.3,10.7,M.dark);
  // Cross section in Y/Z, extruded along X: sloping filter face and rear roll.
  const head=profile(coolant,[[14.8,9.7],[14.8,18.4],[12.1,19.0],[4.9,15.4],[3.8,11.0],[5.8,9.7]],0,7.1);
  head.name='ICS-sloping-filter-housing';head.rotation.y=Math.PI/2;head.position.x=-26.8;
  for(const x of [-26.85,-19.65]){
    // Narrow cheek around the roll opening.
    const cheek=profile(coolant,[[14.8,17.8],[14.8,19.35],[11.8,19.35],[11.2,18.5]],0,.12,M.steelD);cheek.rotation.y=Math.PI/2;cheek.position.x=x;
  }
  const paper=M.cab.clone();paper.color.setHex(0xd4d7d5).convertSRGBToLinear();
  rod(coolant,[-26.55,18.95,-12.8],[-19.9,18.95,-12.8],.48,paper);
  rod(coolant,[-26.55,18.35,-11.7],[-19.9,18.35,-11.7],.2,M.steel);
  // Parallel folds and a recessed handle on the angled service face.
  for(const z of [-10,-9.55,-9.1]){const y=19-(12.1+z)*.5;rod(coolant,[-26.4,y+.025,z],[-20.1,y+.025,z],.045,M.steelD);}
  rod(coolant,[-24.6,17.3,-8.5],[-22,17.3,-8.5],.075,M.black);
  for(const x of [-26.3,-20.2])rod(coolant,[x,12.1,-4.05],[x,13.7,-4.45],.06,M.steelD);
  const makePump=(g,x,z,height)=>{
    cyl(g,x,8.9,z,.85,.25,M.steelD);cyl(g,x,10.6,z,.37,3.5,M.steelD);
    cyl(g,x,12.3+height/2,z,.64,height,M.anth);cyl(g,x,12.2,z,.76,.22,M.steelD);
    cyl(g,x,12.35+height,z,.7,.24,M.steelD);
    for(let i=0;i<14;i++){const a=i*Math.PI/7;box(g,x+Math.cos(a)*.65,12.3+height/2,z+Math.sin(a)*.65,.08,height,.08,M.steelD);}
    box(g,x-.72,12.8,z,.4,.65,.65,M.anth);
    hose(g,[[x,9.5,z],[x+.6,9.7,z+.8],[-26.7,10.8,z+1.1]],.13);
    rod(g,[x+.3,10.2,z+.3],[x+.9,10.2,z+.3],.09,M.red);
  };
  const pump40=new THREE.Group();pump40.name='ICS40';coolant.add(pump40);makePump(pump40,-28.2,-7.5,2.25);
  const pump80=new THREE.Group();pump80.name='ICS80';coolant.add(pump80);
  for(const z of [-6.4,-11])makePump(pump80,-28.2,z,2.7);
  // The high rear separator/control tower distinguishes the ICS 80 configuration.
  box(pump80,-28,15.0,-15.45,2.65,12.8,3.6);
  box(pump80,-28,20.1,-13.6,2.3,1.8,.12,M.steelD);
  for(let i=0;i<7;i++)box(pump80,-28,19.5+i*.16,-13.51,1.9,.05,.035,M.black);
  hose(pump80,[[-28,17,-13.6],[-27.2,17.3,-12.9],[-26.7,17.5,-12]],.12);
  hose(coolant,[[-18.45,4,-7],[-16,2,-6],[-9.45,2.8,-6]]);
  hose(coolant,[[-18.45,4.5,-7.5],[-16,2.5,-6.5],[-9.45,3.3,-6.5]],.1);
  wheels(coolant,-24,-9.4,10.3,15.5);

  const recooler=group('recooler');recooler.position.x=-2.8*k;
  for(const x of [-37.8,-30.5])box(recooler,x,8.8,-9.4,.1,16.1,9.5);
  box(recooler,-34.15,8.8,-14.1,7.4,16.1,.1);
  for(const y of [.8,16.8])box(recooler,-34.15,y,-9.4,7.4,.15,9.5);
  // Front service leaf of the optional recooler (swing shown in the layout).
  const coolerDoor=new THREE.Group();coolerDoor.name='recooler-service-door';coolerDoor.position.set(-37.7,1.2,-4.58);recooler.add(coolerDoor);
  box(coolerDoor,3.55,7.65,0,7.1,15.3,.12);
  for(const y of [2.8,7.3,11.8])box(coolerDoor,3.55,y,.08,6.8,.08,.08,M.dark);
  box(coolerDoor,6.7,8,.14,.12,.7,.16,M.black);
  for(const y of [1,13.5])box(coolerDoor,0,y,.12,.18,.4,.18,M.steelD);
  box(recooler,-34.15,8,-10,5.8,11,3,M.dark);
  for(let i=0;i<15;i++)box(recooler,-34.15,3+i*.7,-8.4,5.5,.13,.16,M.steelD);
  const serviceDoors=[{hinge:coolerDoor,label:'Servisné dvere dochladzovača',side:1,width:7.1,height:15.3,open:false,angle:0,enabled:()=>recooler.visible}];
  cyl(recooler,-34.15,16.96,-9.4,2.8,.1,M.dark);
  for(let i=0;i<13;i++)box(recooler,-37.1+i*.49,17.04,-9.4,.07,.05,7.9,M.steelD);
  for(const x of [-37.2,-31.1])box(recooler,x,17.1,-9.4,.13,.22,8.2);
  for(const z of [-13.45,-5.35])box(recooler,-34.15,17.1,z,6.2,.22,.13);
  box(coolerDoor,3.55,10.9,.1,2.1,2.1,.12,M.cab2);
  box(coolerDoor,3.55,11.35,.18,1.25,.52,.08,M.black);
  for(const [x,mat] of [[3.1,M.red],[3.9,M.steelD]]){const button=cyl(coolerDoor,x,10.45,.22,.11,.05,mat);button.rotation.x=Math.PI/2;}
  for(let i=0;i<14;i++)box(recooler,-37.9,3+i*.85,-9.4,.08,.14,8.4,M.dark);
  hose(recooler,[[-30.45,3,-8],[-30,2.5,-8],[-29.55,3,-8]]);
  wheels(recooler,-34.15,-9.4,6.7,8.8);
  let phase=0;
  const update=(state,dt)=>{
    const mode=state.accessorySetup||'none';drawer.visible=mode==='none';panRails.visible=drawer.visible;
    if(!drawer.visible)chipPan.open=false;
    chipPan.amount=THREE.MathUtils.damp(chipPan.amount,chipPan.open?1:0,5,dt);
    drawer.position.x=-chipPan.amount*chipPan.travel;
    conveyor.visible=['conveyor','ics40','ics80','ics80cooler'].includes(mode);
    coolant.visible=['ics40','ics80','ics80cooler'].includes(mode);
    pump40.visible=mode==='ics40';pump80.visible=mode==='ics80'||mode==='ics80cooler';recooler.visible=mode==='ics80cooler';
    if(state.running&&conveyor.visible)phase=(phase+dt*.22)%1;
    chipCart.amount=THREE.MathUtils.damp(chipCart.amount,chipCart.open&&!state.running?1:0,4,dt);chipCart.object.rotation.z=chipCart.amount*.6;
    flights.forEach((f,i)=>{const u=(i/flights.length+phase)%1;f.position.set(-16.05-8.2*u,3.02+6.5*u,6.5);f.quaternion.copy(belt.quaternion);});
  };
  update({},0);return {equipment,update,chipPan,chipCart,serviceDoors};
}
