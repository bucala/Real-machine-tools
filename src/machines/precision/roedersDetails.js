import * as THREE from 'three';

// Photographic reconstruction. All moving details stay in the original axis
// groups; the machining datum and table/spindle travel remain unchanged.
export function createRoedersDetails({structure,aG,cG,xG,zG,sp,cab,bed,M,group,box,cyl,rod,label,plate,foldedShell,tube,PY}) {
  const face=(p,name,v,m=M.cab2)=>foldedShell(p,name,v,[[0,1,2,3],[3,2,1,0]],m);
  const base=group('faceted-machining-bed',structure);
  box(base,0,8.45,0,14.5,.7,12.8,M.steelD);
  box(base,0,9.0,0,11.7,.7,9.0,M.cab2);
  for(const sign of [-1,1]){
    face(base,'sloped-bed-front-back',[[-7.25,8.6,sign*6.4],[7.25,8.6,sign*6.4],[5.85,9.35,sign*4.5],[-5.85,9.35,sign*4.5]]);
    face(base,'sloped-bed-side',[[sign*7.25,8.6,-6.4],[sign*7.25,8.6,6.4],[sign*5.85,9.35,4.5],[sign*5.85,9.35,-4.5]]);
    for(let i=0;i<9;i++){
      const x=-5.8+i*1.45,z=sign*5.6,y=8.6+(6.4-5.6)*.75/1.9;
      const screw=cyl(base,x,y+.025,z,.105,.025,M.dark);screw.rotation.x=sign*Math.atan(.75/1.9);
      const ring=cyl(base,x,y+.035,z,.055,.027,M.steelD);ring.rotation.copy(screw.rotation);
    }
    for(let i=0;i<7;i++){
      const z=-4.8+i*1.6,x=sign*6.6,y=8.6+(7.25-6.6)*.75/1.4;
      const o=cyl(base,x,y+.02,z,.10,.03,M.dark);o.rotation.z=-sign*Math.atan(.75/1.4);
    }
    // The flange is concentric with A, with an octagonal cast bearing housing.
    const housing=plate(structure,'octagonal-A-bearing',[[-2.9,8.9],[-2.9,PY+1.15],[-1.5,PY+2.6],[1.5,PY+2.6],[2.9,PY+1.15],[2.9,PY-1.8],[1.5,9.2],[-1.5,9.2]],1.25,M.cab2,[],.12);
    housing.rotation.y=Math.PI/2;housing.position.set(sign*5.5-.625,0,0);
    const x=sign*4.78;
    cyl(structure,x,PY,0,2.38,.16,M.inox,'x');cyl(structure,x-sign*.10,PY,0,2.13,.09,M.steelD,'x');cyl(structure,x-sign*.17,PY,0,1.94,.1,M.table,'x');
    for(let i=0;i<18;i++){const a=i*Math.PI/9,y=PY+2.23*Math.sin(a),z=2.23*Math.cos(a);cyl(structure,x-sign*.12,y,z,.075,.07,M.dark,'x');cyl(structure,x-sign*.16,y,z,.035,.075,M.steel,'x');}
    box(structure,sign*6.17,PY-1.7,1.8,.05,.8,.35,M.black);
  }
  // Rounded, rising arms join the central direct-drive bowl in one casting.
  const s=new THREE.Shape();s.moveTo(-4.85,.9);s.lineTo(-4.2,.9);s.bezierCurveTo(-3.65,.8,-4,-1.8,-2.3,-2.05);s.lineTo(2.3,-2.05);s.bezierCurveTo(4,-1.8,3.65,.8,4.2,.9);s.lineTo(4.85,.9);s.lineTo(4.85,-1.1);s.bezierCurveTo(4.7,-2.6,3.3,-3.25,2.3,-3.3);s.lineTo(-2.3,-3.3);s.bezierCurveTo(-3.3,-3.25,-4.7,-2.6,-4.85,-1.1);s.closePath();
  const cradle=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:4.1,steps:1,bevelEnabled:true,bevelSize:.14,bevelThickness:.14,bevelSegments:3,curveSegments:12}),M.table);cradle.name='rounded-trunnion-casting';cradle.position.z=-2.05;cradle.castShadow=true;cradle.receiveShadow=true;aG.add(cradle);
  cyl(aG,0,-1.97,0,2.8,1.18,M.table);cyl(aG,0,-1.36,0,2.76,.12,M.steelD);
  for(const z of [-2.2,2.2]){box(aG,0,-2.62,z,1.05,.45,.04,M.cab2);for(const x of [-.35,.35])cyl(aG,x,-2.62,z+Math.sign(z)*.03,.05,.04,M.steelD,'z');}
  // Slot mouths and their shoulders continue all the way to the table flats.
  for(const z of [-2,-1,0,1,2])for(const dz of [-.065,.065])box(cG,0,.012,z+dz,Math.sqrt(9-z*z)*2-.14,.02,.025,M.inox);

  const head=group('QUADROGUIDE-outer-head',xG);
  for(const sign of [-1,1]){
    const side=[[-3.3,25.3],[-1.65,25.3],[-1.65,20.5],[-2.6,20.5],[-3.3,21.4]].map(([x,y])=>[x*sign,y]);
    plate(head,'faceted-portal-head',side,4.9,M.cab,[],.04).position.z=-2.45;
    box(head,0,22.9,sign*2.05,3.3,4.8,.8,M.cab);
  }
  // Four separate skins leave a vertical passage for the ram and its guides.
  label(head,'röders',0,23.3,2.51,2.5,.7,{size:130});label(head,'TEC',0,22.65,2.51,1.25,.42,{size:110});
  for(const x of [-2.85,2.85])for(const y of [21.6,24.7])cyl(head,x,y,2.53,.045,.04,M.steelD,'z');
  const moving=group('spindle-guide-detail',zG);
  for(const x of [-1.3,1.3])for(const z of [-1.3,1.3]){
    cyl(moving,x,3.5,z,.15,4.6,M.steel);
    for(const y of [1.25,5.75]){box(moving,x,y,z,.52,.3,.52,M.cab2);cyl(moving,x,y-.19,z,.22,.12,M.inox);}
  }
  const manifold=group('spindle-coolant-manifold',sp);
  cyl(manifold,0,.82,0,1.16,.14,M.inox);cyl(manifold,0,.62,0,.85,.12,M.steelD);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,x=Math.cos(a),z=Math.sin(a);
    cyl(manifold,x,.64,z,.095,.25,M.steelD);cyl(manifold,x,.47,z,.12,.1,M.brass||M.steel);
    rod(manifold,[x,.42,z],[x*.6,.04,z*.6],.045,M.inox);
  }
  for(const sign of [-1,1])tube(moving,[[sign*1.5,5.7,-1.5],[sign*1.75,3.1,-1.65],[sign*1.65,1.4,-1.4],[sign,1.2,-.7]],.07,M.black);

  const liner=group('stainless-workspace-panels',structure);
  for(const sign of [-1,1]){
    face(liner,'rear-splayed-liner',[[sign*6.6,9.4,-5.1],[sign*3.7,9.4,-6.6],[sign*3.7,23.4,-6.6],[sign*6.6,20.6,-5.1]],M.cab2);
    for(const y of [10.2,14,18,20])cyl(liner,sign*6.2,y,-5.35,.055,.045,M.steelD,'z');
    rod(liner,[sign*6.45,9.7,-4.95],[sign*3.8,22.9,-6.45],.065,M.inox);
    const gutter=group('stainless-chip-gutter',structure);gutter.position.x=sign*7;
    box(gutter,0,8.1,0,.42,.15,12.6,M.inox);box(gutter,sign*.23,8.3,0,.08,.55,12.6,M.inox);
  }
  // Exterior seams, fasteners, air connection and vented plinth from the photos.
  for(const x of [-10,-7,-3,1,5,9])for(const y of [1.5,5.9])cyl(bed,x,y,11.27,.05,.035,M.steelD,'z');
  for(let row=0;row<3;row++)for(let col=0;col<9;col++)box(bed,6+col*.42,2+row*.32,11.28,.27,.09,.035,M.dark);
  label(bed,'RXU · QUADROGUIDE',-.8,5.2,11.29,2.6,.25,{color:'#ccd0d0',background:'#9d182f',size:75});
  for(const y of [8.1,27.4])for(const x of [-10.5,-9.3])cyl(cab,x,y,11.25,.04,.035,M.steelD,'z');
  const air=group('operator-air-hose',cab);
  const coil=[];for(let i=0;i<=120;i++){const t=i/120,a=t*Math.PI*22;coil.push(new THREE.Vector3(-20+.25*Math.cos(a),9.3-t*5.5,-6.6+.25*Math.sin(a)));}
  const hose=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil),264,.038,8,false),new THREE.MeshStandardMaterial({color:new THREE.Color(0x327aab).convertSRGBToLinear(),roughness:.65}));hose.name='blue-coiled-air-hose';air.add(hose);
  rod(air,[-20,9.3,-6.6],[-20,10,-6.6],.07,M.steel);box(air,-20.1,10.2,-6.6,.2,.5,.14,M.black);
  const service=group('right-service-filter-and-lines',cab);
  box(service,9.65,12.2,-5.1,.25,4.4,3.2,M.steelD);
  for(const z of [-6.1,-4.2]){
    cyl(service,10.05,12.35,z,.44,2.7,M.inox);cyl(service,10.05,13.8,z,.52,.25,M.dark);
    tube(service,[[10.05,13.9,z],[10.15,14.65,z],[9.4,15.1,z-1]],.075,M.black);
  }
}
