import * as THREE from 'three';

// C42 layout, in 100 mm units: cabin 2450 mm, conveyor reach 1710 mm,
// ICS footprint 1110 × 1630 mm, recooler 740 × 950 mm. C32 scales by cabin width.
export function createAccessories(parent, M, scale, halfWidth = 11.4 * scale) {
  const equipment = {}, k = halfWidth / 12.25;
  const group = (name) => { const g=new THREE.Group(); g.name=name; g.scale.setScalar(k); parent.add(g); equipment[name]=g; return g; };
  const box=(g,x,y,z,w,h,d,m=M.cab2)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;};
  const cyl=(g,x,y,z,r,h,m=M.steelD)=>{const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24),m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
  const link=(g,a,b,w,d,m=M.cab2)=>{const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),v=q.clone().sub(p);const o=box(g,0,0,0,w,v.length(),d,m);o.position.copy(p).add(q).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return o;};
  const hose=(g,pts,r=.12)=>{g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p))),24,r,8,false),M.black));};
  const wheels=(g,x,z,w,d)=>{for(const dx of [-w/2,w/2])for(const dz of [-d/2,d/2]){box(g,x+dx,.65,z+dz,.15,.35,.35,M.steel);cyl(g,x+dx,.32,z+dz,.27,.2,M.black).rotation.z=Math.PI/2;}};
  const drawer=new THREE.Group();drawer.scale.setScalar(k);parent.add(drawer);
  box(drawer,-12.5,2,6.5,.65,1.7,6.8);box(drawer,-12.9,2.2,6.5,.1,.15,1.4,M.black);
  const conveyor=group('conveyor'), flights=[];
  box(conveyor,-14.3,2,6.5,4.3,1.8,3.4);
  const start=[-16.3,2.8,6.5],end=[-24.5,9.4,6.5];
  link(conveyor,start,end,1.05,3.4);
  const belt=link(conveyor,[-16.05,3.1,6.5],[-24.25,9.7,6.5],.12,2.7,M.dark);
  for(const z of [4.9,8.1])link(conveyor,[-16.1,3.1,z],[-24.3,9.7,z],.65,.15);
  for(let i=0;i<14;i++)flights.push(box(conveyor,0,0,0,.15,.18,2.5,M.steelD));
  box(conveyor,-25.1,9.6,6.5,2.7,1.1,3.6);box(conveyor,-26,8.8,6.5,1.3,1,2.7,M.dark);
  cyl(conveyor,-24.7,10,4.2,.6,1.5).rotation.x=Math.PI/2;
  for(const z of [4.9,8.1])link(conveyor,[-20.4,.8,z],[-20.4,5.8,z],.22,.22,M.steelD);
  wheels(conveyor,-20.4,6.5,.6,3.4);
  // Open chip cart ahead of the coolant branch, as in the plan view.
  box(conveyor,-26.55,.9,6.5,4.2,.25,4.5);
  for(const z of [3.65,9.35]){
    const p=new THREE.Shape();p.moveTo(-28.65,1);p.lineTo(-24.45,1);p.lineTo(-23.75,7.5);p.lineTo(-29.35,7.5);p.closePath();
    const wall=new THREE.Mesh(new THREE.ExtrudeGeometry(p,{depth:.12,bevelEnabled:false}),M.cab2);wall.position.z=z;conveyor.add(wall);
  }
  link(conveyor,[-28.65,1,6.5],[-29.35,7.5,6.5],.12,5.7);link(conveyor,[-24.45,1,6.5],[-23.75,7.5,6.5],.12,5.7);
  box(conveyor,-26.55,1.08,6.5,4,.1,4.4,M.dark);
  for(let i=0;i<8;i++)box(conveyor,-29+i*.7,7.5,9.5,.7,.25,.1,i%2?M.black:M.yellow);
  wheels(conveyor,-26.55,6.5,3.8,4.2);

  const coolant=group('coolant');
  box(coolant,-24,3.4,-9.4,11.1,5.4,16.3);
  box(coolant,-24,6.18,-9.4,11.1,.15,16.3,M.steel);
  box(coolant,-25.7,12.9,-10.5,7.1,13.3,12.8,M.cab);
  const top=new THREE.Shape();top.moveTo(-29.25,19.55);top.lineTo(-22.15,19.55);top.lineTo(-22.15,21.5);top.lineTo(-27.8,21.5);top.closePath();
  const cover=new THREE.Mesh(new THREE.ExtrudeGeometry(top,{depth:12.8,bevelEnabled:false}),M.cab2);cover.position.z=-16.9;coolant.add(cover);
  for(const y of [10,16]){box(coolant,-25.7,y,-4.02,6.6,5.5,.12);box(coolant,-25.7,y+.7,-3.9,.7,.15,.12,M.black);}
  const pump40=new THREE.Group();pump40.name='ICS40';coolant.add(pump40);
  cyl(pump40,-20.1,10,-10.5,.65,7);cyl(pump40,-20.1,14.2,-10.5,.9,1.5,M.anth);
  const pump80=new THREE.Group();pump80.name='ICS80';coolant.add(pump80);
  for(const z of [-13,-8]){cyl(pump80,-20.1,10.7,z,.65,8.5);cyl(pump80,-20.1,15.7,z,.9,1.7,M.anth);}
  box(coolant,-19.6,12,-3.9,1.4,2.1,.4,M.dark);
  hose(coolant,[[-18.45,4,-7],[-16,2,-6],[-12.25,2.8,-6]]);
  hose(coolant,[[-18.45,4.5,-7.5],[-16,2.5,-6.5],[-12.25,3.3,-6.5]],.1);
  wheels(coolant,-24,-9.4,10.3,15.5);

  const recooler=group('recooler');
  box(recooler,-34.15,8.8,-9.4,7.4,16.1,9.5);
  for(const y of [4,8.5,13])box(recooler,-34.15,y,-4.58,7,.08,.1,M.dark);
  cyl(recooler,-34.15,16.96,-9.4,3.1,.15,M.dark);
  for(let i=0;i<11;i++){const dx=-2.7+i*.54;box(recooler,-34.15+dx,17.06,-9.4,.08,.05,Math.sqrt(Math.max(0,9-dx*dx))*2,M.steelD);}
  for(let i=0;i<14;i++)box(recooler,-37.9,3+i*.85,-9.4,.08,.14,8.4,M.dark);
  hose(recooler,[[-30.45,3,-8],[-30,2.5,-8],[-29.55,3,-8]]);
  wheels(recooler,-34.15,-9.4,6.7,8.8);
  let phase=0;
  const update=(state,dt)=>{
    const mode=state.accessorySetup||'none';drawer.visible=mode==='none';
    conveyor.visible=['conveyor','ics40','ics80','ics80cooler'].includes(mode);
    coolant.visible=['ics40','ics80','ics80cooler'].includes(mode);
    pump40.visible=mode==='ics40';pump80.visible=mode==='ics80'||mode==='ics80cooler';recooler.visible=mode==='ics80cooler';
    if(state.running&&conveyor.visible)phase=(phase+dt*.22)%1;
    flights.forEach((f,i)=>{const u=(i/flights.length+phase)%1;f.position.set(-16.05-8.2*u,3.27+6.6*u,6.5);f.quaternion.copy(belt.quaternion);});
  };
  update({},0);return {equipment,update};
}
