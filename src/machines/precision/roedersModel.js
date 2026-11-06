import * as THREE from 'three';
import { modelKit } from './modelKit';
import { createRmsPanel } from './rmsPanel';
import { createToolModel } from '../cnc/toolModel';
import { RXU_LAYOUT as L, RXU_PLAN } from './roedersLayout';

// RXU 1001 DSH: exterior p58, A/C sections p58–59, related base-machine plan p57.
// Sheet metal is a photographic reconstruction. Keep it separate from the CNC datum.
export function createRoedersModel({root,G,M,tex,MC,PY}){
  const {group,box,cyl,rod,label,bolts,clear}=modelKit(root,M,tex);
  const part=(k,parent=root)=>{const g=group(k,parent);g.userData.part=k;G[k]=g;return g;};
  M.red.color.setHex(0x9d182f).convertSRGBToLinear();
  M.lamp=new THREE.MeshStandardMaterial({color:0xeaf5ff,emissive:0xeaf5ff,emissiveIntensity:3});
  M.brush=M.inox;M.yellow=new THREE.MeshStandardMaterial({color:0xf4c32b});
  const shape=(points,holes=[])=>{
    const s=new THREE.Shape(points.map(p=>new THREE.Vector2(...p)));
    holes.forEach(h=>s.holes.push(new THREE.Path(h.map(p=>new THREE.Vector2(...p)))));return s;
  };
  const plate=(parent,name,points,depth,mat,holes=[],bevel=.035)=>{
    const o=new THREE.Mesh(new THREE.ExtrudeGeometry(shape(points,holes),{depth,steps:1,bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:1,curveSegments:16}),mat);
    o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
  };
  const footprint=(p,name,points,y,h,mat)=>{
    // Shape's Y maps to -world Z after rotating the extrusion into the floor.
    const o=plate(p,name,points.map(([x,z])=>[x,-z]),h,mat,[],0);o.rotation.x=-Math.PI/2;o.position.y=y;return o;
  };
  // Explicit flat folds: unlike rotated boxes these share their arrises exactly,
  // and a triangular end can converge to a single tip without a square end cap.
  const foldedShell=(parent,name,vertices,faces,mat=M.cab)=>{
    const positions=[];
    for(const face of faces)for(let i=1;i<face.length-1;i++){
      for(const j of [face[0],face[i],face[i+1]])positions.push(...vertices[j]);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,mat);mesh.name=name;
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  const tube=(p,points,r=.06,mat=M.black)=>{const path=new THREE.CatmullRomCurve3(points.map(v=>new THREE.Vector3(...v)));const o=new THREE.Mesh(new THREE.TubeGeometry(path,32,r,8,false),mat);o.castShadow=true;p.add(o);return o;};
  const rim=(p,points,mat=M.dark,r=.045)=>{for(let i=0;i<points.length;i++)rod(p,points[i],points[(i+1)%points.length],r,mat);};
  const bed=part('lozko');
  // The stepped front plinth and the L-shaped rear service spine follow the plan.
  footprint(bed,'stepped-burgundy-plinth',RXU_PLAN.slice(0,2).concat([[10.95,-22.8],[-16.1,-22.8],[-16.1,-.5],[-10.95,-.5]]),.8,6.25,M.red);
  footprint(bed,'base-shadow-gap',RXU_PLAN,.5,.25,M.black);
  for(const [x,z] of [[-9,8],[9,8],[-14,-18],[9,-19],[8,-34]]){
    cyl(bed,x,.22,z,.55,.4,M.steelD);cyl(bed,x,.6,z,.24,.5,M.steelD);
  }
  for(const y of [1.7,5.7])for(const x of [-9,-5,0,5,9])cyl(bed,x,y,L.front+.025,.055,.04,M.steelD,'z');
  box(bed,0,7.13,10.95,22.3,.13,.65,M.red);

  // The work station is offset towards the front-left loading bay. Move the
  // complete frame (stock, trunnion, spindle and axes) together, so the CNC datum
  // remains coincident with the visible fixture. A is along the two bearing centres.
  const machiningFrame=group('RXU-machining-frame');machiningFrame.position.set(...L.workCentre);
  const structure=group('mineral-cast-support',machiningFrame);structure.userData.part='lozko';
  box(structure,0,8.0,0,14,1.5,12.7,M.anth);
  for(const x of [-5.5,5.5]){
    const pedestal=plate(structure,'A-bearing-pedestal',[[-2.2,0],[-2.2,4.8],[-1.5,5.8],[1.5,5.8],[2.2,4.8],[2.2,0]],1.45,M.cab2);
    pedestal.rotation.y=Math.PI/2;pedestal.position.set(x-.72,8.2,0);
    cyl(structure,x,PY,0,2.25,1.6,M.table,'x');
    cyl(structure,x+(x<0?.86:-.86),PY,0,2.0,.16,M.steelD,'x');
    for(let i=0;i<12;i++){const a=i*Math.PI/6;cyl(structure,x+(x<0?.97:-.97),PY+1.8*Math.sin(a),1.8*Math.cos(a),.07,.055,M.steel,'x');}
  }
  // Sloped stainless collection floor, with two screw channels at the edges.
  for(const z of [-4.4,4.4]){
    const chute=box(structure,0,8.35,z,13,.1,2.8,M.inox);chute.rotation.x=z<0?-.28:.28;
    cyl(structure,0,7.8,z, .28,13,M.steelD,'x');
  }
  const aG=group('A-cradle',part('stol',machiningFrame));aG.position.y=PY;
  plate(aG,'contoured-two-sided-cradle',[
    [-5.3,1.1],[-4.65,1.1],[-4.1,-.9],[-2.1,-2.35],[2.1,-2.35],[4.1,-.9],[4.65,1.1],[5.3,1.1],
    [5.3,-1.3],[2.5,-3.2],[-2.5,-3.2],[-5.3,-1.3],
  ],4.5,M.table).position.z=-2.25;
  for(const x of [-4.9,4.9])cyl(aG,x,0,0,1.7,1.05,M.table,'x');
  cyl(aG,0,-1.85,0,2.65,1.05,M.cab2);
  const cG=group('C-direct-drive',aG);cG.position.y=-MC.hA*.01;
  const tableOutline=[],flatAngle=Math.asin(2.6/3);
  for(let i=0;i<=32;i++){const a=-flatAngle+i*2*flatAngle/32;tableOutline.push([Math.cos(a)*3,Math.sin(a)*3]);}
  for(let i=0;i<=32;i++){const a=Math.PI-flatAngle+i*2*flatAngle/32;tableOutline.push([Math.cos(a)*3,Math.sin(a)*3]);}
  const tableFace=plate(cG,'600mm-table-with-two-flats',tableOutline,.4,M.table,[],0);tableFace.rotation.x=-Math.PI/2;tableFace.position.y=-.4;
  for(const z of [-2,-1,0,1,2])box(cG,0,.008,z,Math.sqrt(9-z*z)*2-.12,.018,.085,M.steelD);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;cyl(cG,Math.cos(a)*2.65,.015,Math.sin(a)*2.65,.045,.025,M.black);}
  cyl(cG,0,.1,0,.47,.2,M.steelD);cyl(cG,0,.35,0,.35,.3,M.anth);
  const clampPins=[0,1,2].map(i=>{const g=group('clamp',cG);g.rotation.y=i*Math.PI*2/3;return box(g,0,.35,.35,.12,.12,.16,M.steel);});

  const ax=part('osi',machiningFrame),yG=group('Y-carrier',ax),xG=group('X-saddle',yG),zG=group('Z-quadroguide',xG);
  // Four corner rails and two carriages per rail. The upper portal fits UNDER the roof.
  for(const x of [-6.8,6.8]){
    box(ax,x,21.9,0,1.2,3.8,13,M.anth);
    for(const dx of [-.36,.36])box(ax,x+dx,24,0,.17,.2,12.8,M.steel);
  }
  for(const z of [-2.1,2.1])box(yG,0,24.35,z,14.9,.65,.5,M.cab2);
  for(const x of [-7.1,7.1])box(yG,x,24.35,0,.7,.65,4.7,M.cab2);
  for(const z of [-1.9,1.9])box(yG,0,24.78,z,14.6,.16,.2,M.steel);
  for(const x of [-1.6,1.6])box(xG,x,22.6,0,.6,4.1,3.8,M.cab2);
  for(const z of [-1.6,1.6])box(xG,0,22.6,z,2.6,4.1,.6,M.cab2);
  box(zG,0,4.35,0,2.35,7.0,2.35,M.cab);
  for(const x of [-1.2,1.2])for(const z of [-1.2,1.2]){
    box(zG,x,4.35,z,.14,7.0,.14,M.steel);
    for(const y of [20.95,22.2])box(xG,x,y,z,.4,.55,.4,M.steelD);
  }
  const sp=group('HSK-A63',zG);sp.userData.part='vreteno';G.vreteno=sp;
  box(sp,0,1.15,0,2.5,.75,2.5,M.cab);
  cyl(sp,0,.53,0,.76,.75);cyl(sp,0,.13,0,.56,.26,M.steelD);
  for(const y of [.25,.45,.65])cyl(sp,0,y,0,.78,.045,M.steelD);
  for(const x of [-1.05,1.05]){
    cyl(sp,x,.6,.6,.12,.6,M.steelD);
    tube(sp,[[x,1.1,.6],[x*.9,.5,.85],[x*.5,.03,.6]],.055,M.dark);
  }
  const toolG=group('tool',sp),buildTool=t=>{clear(toolG);if(t)toolG.add(createToolModel(t,M));};
  // Telescopic stainless way covers, not a wall of exposed vertical fins.
  const covers=[];
  for(const s of [-1,1])for(let i=0;i<9;i++){
    const fold=box(yG,0,23.55,2.1,.4,.16,3.0,i%2?M.inox:M.cab2);fold.userData={side:s,index:i};covers.push(fold);
  }
  const chain=group('Y-energy-chain',ax);
  for(let i=0;i<24;i++){const t=i/23;box(chain,-6.1,25+Math.sin(t*Math.PI)*.9,-5.2+t*10,.45,.23,.39,M.black);}
  const backLiner=group('sloped-workspace-liner',structure);
  const liner=plate(backLiner,'rear-stainless-bulkhead',[[-6.6,8.8],[-6.6,19.9],[-3.5,23.6],[3.5,23.6],[6.6,19.9],[6.6,8.8]],.12,M.cab2);
  liner.position.z=-5.3;
  for(const s of [-1,1])rod(backLiner,[s*6.4,9,-5.1],[s*2.4,23.3,-5.1],.055,M.steelD);

  // Standard rear rotary magazine. The transfer carriage brings its selected holder
  // to the spindle; its undocumented internal linkage is an illustrative reconstruction.
  const mag=part('zasobnik'),magY=PY+(MC.nose[1]-80)*.01,magZ=-15.4,magX=L.workCentre[0];
  box(mag,magX,11.8,magZ,9,9.2,8.5,M.anth);
  for(const x of [magX-2.8,magX+2.8])box(mag,x,magY-2.2,magZ,.8,4.4,7,M.steelD);
  const magG=group('24-pocket-carousel',mag);magG.position.set(magX,magY,magZ);
  cyl(magG,0,-.2,0,3.6,.4,M.steelD);cyl(magG,0,.1,0,.65,.6,M.steel);
  const driveShaft=group('carousel-shaft',mag);driveShaft.position.copy(magG.position);cyl(driveShaft,0,-1.2,0,.28,2.9,M.steel);
  const pockets=[];
  for(let i=0;i<MC.mag;i++){
    const a=i*Math.PI*2/MC.mag,g=group(`T${i+1}`,magG);g.position.set(Math.sin(a)*3.6,0,Math.cos(a)*3.6);g.rotation.y=a;
    for(const x of [-.23,.23])box(g,x,0,0,.07,.12,.48,M.red);
    box(g,0,0,-.22,.52,.12,.07,M.red);pockets.push(group('holder',g));
  }
  const loadMagazine=tls=>pockets.forEach((g,i)=>{clear(g);const t=tls.find(t=>t.t===i+1);if(t)g.add(createToolModel(t,M));});
  const transferX=L.workCentre[0],transferZ=L.workCentre[2]-MC.tcY*.01;
  const saddle=group('tool-transfer-carriage',mag);saddle.position.set(transferX,magY,-11.8);
  box(saddle,0,.45,0,1.1,.45,1.1,M.steelD);
  const transferTool=group('transfer-holder',saddle);let transferT=0;
  for(const s of [-1,1])box(saddle,s*.31,0,0,.12,.13,.75,M.red);
  for(const x of [transferX-.6,transferX+.6])rod(mag,[x,magY+.7,-12],[x,magY+.7,transferZ],.085,M.steel);
  for(const z of [-12,transferZ])box(mag,transferX,magY+1.3,z,1.9,1.1,.25,M.anth);

  const cab=part('kabina');
  const wall=(x,y,z,w,h,d,mat=M.cab)=>box(cab,x,y,z,w,h,d,mat);
  // One side elevation controls the hood underside, door rebate and glass cut.
  // The rear casing comes forward into this fold; it is not a long free spike.
  const cheekX=-10.96,rearCheekX=-12.4,rearZ=2.4,foldZ=6.4,foldY=23.8;
  const foldSlope=.6,foldHeight=z=>foldY+(z-foldZ)*foldSlope;
  // Taller shoulder contains the portal; rear spine and cross-cabinet leave the
  // service recess OPEN. Nothing fills the absent rectangle in the p57 plan.
  const shoulderCentre=(L.shoulderLeft+L.right)/2,shoulderWidth=L.right-L.shoulderLeft;
  footprint(cab,'tower-roof-forward-chamfer',[
    [L.shoulderLeft,-22.8],[L.right,-22.8],[L.right,rearZ],
    [rearCheekX,rearZ],[L.shoulderLeft,-.5],
  ],35.2,.3,M.cab2);
  wall(L.shoulderLeft,21.3,-11.65,.16,28.1,22.3);
  // Long right skin with the small glazed service inspection hatch from the side photo.
  wall(L.right,21.3,-15,.16,28.1,15.6);
  wall(L.right,21.3,-1.5,.16,28.1,3);
  wall(L.right,8.6,-5.1,.16,2.7,4.2);
  wall(L.right,25.425,-5.1,.16,19.85,4.2);
  const rightGlass=new THREE.Mesh(new THREE.PlaneGeometry(4.2,5.5),M.glass);rightGlass.rotation.y=Math.PI/2;rightGlass.position.set(11.05,12.75,-5.1);rightGlass.name='right-service-inspection-window';cab.add(rightGlass);
  for(const z of [-7.2,-3])box(cab,11.08,12.75,z,.09,5.8,.12,M.steelD);
  for(const y of [10,15.5])box(cab,11.08,y,-5.1,.09,.12,4.35,M.steelD);
  box(cab,11.18,12.2,-2.6,.13,1,.18,M.black);
  for(const y of [10.2,15.3])box(cab,11.17,y,-7.4,.2,.35,.2,M.steelD);
  label(cab,'CAUTION',11.2,15.2,-5.1,1.25,.24,{rotate:Math.PI/2,color:'#2c3035',background:'#e5ce38',size:110});
  wall(shoulderCentre,21.3,-22.8,shoulderWidth,28.1,.16);
  // Tower face above the lower machining hood, with recessed service covers.
  wall((rearCheekX+L.right)/2,31.55,rearZ,L.right-rearCheekX,7.6,.16);
  for(const x of [-9.8,6.7]){
    wall(x,31.55,rearZ+.12,3.6,3.2,.05,M.dark);wall(x,31.55,rearZ+.17,3.52,3.12,.06,M.cab);
    bolts(cab,x,31.55,rearZ+.22,3.2,2.8);
  }
  // Full-height diagonal return moves the rear wall forward, including the
  // corner above the hood. Close the old square corner rather than overlay it.
  const forwardReturn=[
    [L.shoulderLeft,7.2,-.5],[rearCheekX,7.2,rearZ],
    [rearCheekX,35.35,rearZ],[L.shoulderLeft,35.35,-.5],
  ];
  foldedShell(cab,'tower-forward-splayed-wall',forwardReturn,[[0,1,2],[0,2,3],[2,1,0],[3,2,0]]);
  wall((rearCheekX+cheekX)/2,17.55,rearZ,cheekX-rearCheekX,20.7,.18);
  wall(L.right,31.3,(rearZ-.5)/2,.16,8.1,rearZ+.5);
  for(const y of [9,17,26,34])for(const z of [-21,-12,-2])cyl(cab,-16.21,y,z,.04,.04,M.steelD,'x');
  label(cab,'röders TEC',-16.21,23,-5,3.1,1,{rotate:-Math.PI/2,background:'#e6e8ea',size:45});
  const spineW=L.right-L.rearSpineLeft,spineZ=(L.rear+L.shoulderRear)/2;
  wall((L.right+L.rearSpineLeft)/2,12.75,spineZ,spineW,23.5,L.shoulderRear-L.rear,M.cab2);
  wall((L.right+L.rearCrossLeft)/2,12.75,(L.rear+L.rearCrossFront)/2,L.right-L.rearCrossLeft,23.5,L.rearCrossFront-L.rear,M.cab);
  // Two cabinet cooling modules and the large extraction duct visible in the rear photos.
  for(const z of [-17.4,-21.8]){
    box(cab,11.85,29.1,z,1.75,4.6,3.3,M.cab2);box(cab,12.75,29.1,z,.08,4.1,2.9,M.cab);
    for(let i=0;i<10;i++)box(cab,12.81,27.7+i*.28,z,.05,.055,2.3,M.steelD);
    box(cab,12.83,30.5,z,.07,.6,1.1,M.dark);
  }
  tube(cab,[[5.2,30.2,-22.9],[5.2,30.7,-25.5],[5.2,26.0,-28.7],[5.2,24.6,-30.0]],.63,M.steelD);
  // Service seams/handles on both exposed faces of the electrical cabinet.
  for(const z of [-25.5,-30.8,-34.8]){
    wall(11.055,12.75,z,.045,22.6,3.6,M.dark);wall(11.09,12.75,z,.06,22.5,3.5,M.cab);
    box(cab,11.16,15,z-1.1,.12,1.1,.16,M.black);
  }
  for(const x of [-4.5,0,5.5]){
    wall(x,12.75,-37.04,4.2,22.5,.08,M.cab2);box(cab,x+1.6,15,-37.14,.13,1.1,.12,M.black);
  }
  for(let i=0;i<15;i++)box(cab,6,21+i*.14,-37.12,5,.055,.04,M.dark);

  // Front: narrow white left cheek, red sliding leaf, wide right service fascia.
  // The upper front fold runs across the whole machine, not diagonally across
  // each fascia's X/Y corner. Its two pitches are in the side-window Y/Z plane.
  const frontProfile=[[-10.95,7.1],[-10.95,28.2],[-8.55,28.2],[-8.55,7.1]];
  plate(cab,'front-left-cheek',frontProfile,.55,M.cab).position.z=10.65;
  const rightProfile=[[3.35,7.1],[10.95,7.1],[10.95,28.2],[3.35,28.2]];
  plate(cab,'right-service-fascia',rightProfile,.35,M.cab).position.z=10.76;
  wall(10.95,17.2,5.35,.16,20.2,11.7);
  const roofProfile=[[rearZ,28.9,rearCheekX],[foldZ,28.692,cheekX],[11.2,28.2,cheekX]]; // [Z,Y,left X]
  const roofVertices=roofProfile.flatMap(([z,y,left])=>[[left,y,z],[10.95,y,z]]);
  roofVertices.push(...roofVertices.map(([x,y,z])=>[x,y-.12,z]));
  foldedShell(cab,'full-width-double-fold-roof',roofVertices,[
    [0,2,3,1],[2,4,5,3], // two separately shaded, full-width slopes
    [6,7,9,8],[8,9,11,10], // underside
    [0,1,7,6],[4,10,11,5],[0,6,8,2],[2,8,10,4],[1,3,9,7],[3,5,11,9],
  ]);
  // Close the right return up to the same roof profile; no stepped flat lid.
  const roofReturn=group('right-roof-return',cab);roofReturn.position.x=11.03;roofReturn.rotation.y=-Math.PI/2;
  plate(roofReturn,'right-upper-return',[[rearZ,27.25],[11.2,27.25],[11.2,28.2],[foldZ,28.692],[rearZ,28.9]],.16,M.cab,[],0);
  // Actual side window: polygon cut out of the folded cheek, with a separate glass.
  const side=group('left-window-cheek',cab);side.position.set(cheekX,0,0);side.rotation.y=-Math.PI/2;
  const rebate=.16,glassInset=1.3;
  const sideOutline=[[rearZ,7.1],[11.2,7.1],[11.2,28.2],[foldZ,28.692],[foldZ,foldHeight(foldZ)-rebate],[rearZ,foldHeight(rearZ)-rebate]];
  const glassRear=3.2,glassFold=5.2;
  const aperture=[[glassRear,11.1],[9.0,11.1],[9.0,foldHeight(glassFold)-glassInset],[glassFold,foldHeight(glassFold)-glassInset],[glassRear,foldHeight(glassRear)-glassInset]];
  plate(side,'left-window-sheet-metal',sideOutline,.14,M.cab,[aperture]);
  const sideGlass=new THREE.Mesh(new THREE.ShapeGeometry(shape(aperture)),M.glass);sideGlass.name='left-observation-window';sideGlass.position.z=.16;side.add(sideGlass);
  rim(side,aperture.map(([x,y])=>[x,y,.18]),M.dark,.055);
  for(const [z,y] of [[3.0,8.5],[8.7,8.5],[8.7,25.6]])box(side,z,y,.22,.19,.3,.15,M.black);
  // Broad upper cheek and the lower window hood are distinct sheet-metal folds.
  // The rear return supports the short, blunt hood. Its clipped end replaces
  // the exaggerated pyramid tip; the underside and door/glass bevels are parallel.
  foldedShell(cab,'left-upper-cheek-fold',[
    [cheekX,foldY,foldZ],[cheekX,28.692,foldZ],[rearCheekX,28.9,rearZ],[rearCheekX,23.0,rearZ],
  ],[[0,1,2],[0,2,3],[2,1,0],[3,2,0]]);
  foldedShell(cab,'left-window-blunt-hood',[
    [cheekX,foldHeight(rearZ),rearZ],[cheekX,foldY,foldZ],
    [rearCheekX-.25,foldHeight(rearZ),rearZ],[rearCheekX,23.0,rearZ],
    [rearCheekX-.25,foldHeight(rearZ)+.38,rearZ],
  ],[[0,1,2],[2,1,4],[4,1,3],[0,2,4,3],[0,3,1]]);
  const door=group('right-sliding-loading-door',cab);door.userData.s=1;
  const doorShape=[[0,0],[11.7,0],[11.7,19.9],[11.15,20.85],[.25,20.85],[0,20.2]];
  const doorWindow=[[1.85,2.5],[10.05,2.5],[10.05,15.4],[1.85,15.4]];
  plate(door,'red-sliding-leaf',doorShape,.32,M.red,[doorWindow]);
  const frontGlass=new THREE.Mesh(new THREE.PlaneGeometry(8.2,12.9),M.glass);frontGlass.position.set(5.95,8.95,.16);frontGlass.name='front-observation-window';door.add(frontGlass);
  rim(door,doorWindow.map(([x,y])=>[x,y,.345]),M.steelD,.055);
  rod(door,[.95,3.0,.62],[.95,12.2,.62],.105,M.steelD);
  for(const y of [3.1,12.1])rod(door,[.95,y,.32],[.95,y,.68],.095,M.black);
  // Door runs IN FRONT of the right service fascia; no hinge or outward swing.
  box(cab,1.15,7.25,11.46,19.6,.14,.25,M.steelD);
  box(cab,7.2,7.55,11.36,7.8,.34,.24,M.inox);
  for(const y of [7.4,7.62,7.85])box(cab,7.1,y,11.48,7.6,.05,.08,M.steelD);
  for(const x of [1.1,7.2])box(door,x,.05,.06,.85,.32,.45,M.steelD);
  label(cab,'RXU 1001',7.15,25.6,11.2,5.6,.85,{size:140});
  label(cab,'DSH',7.15,24.65,11.2,2.5,.7,{size:140});
  label(cab,'röders',7.15,19.15,11.2,4.3,.9,{size:150});
  label(cab,'TEC',7.15,18.4,11.2,2,.55,{size:145});
  wall(6.55,13.25,11.15,5.2,7.7,.035,M.steelD);wall(6.55,13.25,11.18,5.08,7.58,.04);
  for(const x of [4.25,8.8])cyl(cab,x,13.1,11.23,.075,.045,M.steelD,'z');
  for(const y of [9.3,26])bolts(cab,7.15,y,11.23,6.6,.2);

  // RMS is beside the wider left shoulder, behind the side viewing window.
  // The articulated bracket is attached to the chassis, not a detached floor post.
  const pan=part('panel'),armPivot=group('terminal-shoulder',pan);armPivot.position.set(-16.25,0,-8.7);
  box(pan,-16.23,10.8,-8.7,.3,2.1,1.4,M.steelD);cyl(armPivot,0,10.4,0,.37,1.9,M.steelD);
  box(armPivot,-1.2,10.4,0,2.4,.4,.65,M.steelD);
  const armElbow=group('terminal-elbow',armPivot);armElbow.position.set(-2.4,0,0);
  cyl(armElbow,0,10.4,0,.32,.8,M.steelD);rod(armElbow,[0,10.4,0],[-1.65,10.4,2.4],.18,M.steelD);
  const panG=group('RMS-console',armElbow);panG.position.set(-1.65,2.1,2.4);panG.scale.setScalar(.9);
  const hmi=createRmsPanel(panG,M,tex);
  tube(pan,[[-16.3,10.5,-8.7],[-18,9.1,-8.5],[-20.3,9,-6.7]],.07);

  const cart=group('rear-chip-cart',bed),C=L.chipCart;cart.position.set(C.x,0,C.z);
  // Two screw outlets discharge into a separate wheeled collector, near the rear.
  box(cart,0,2.0,0,C.width+.15,.35,C.depth+.15,M.red);
  box(cart,0,3.2,0,C.width-.1,.18,C.depth-.1,M.inox);
  for(const x of [-C.width/2,C.width/2])box(cart,x,6.1,0,.14,5.8,C.depth,M.cab2);
  for(const z of [-C.depth/2,C.depth/2])box(cart,0,6.1,z,C.width,5.8,.14,M.cab2);
  for(const x of [-3.8,3.8])for(const z of [-6.5,6.5]){box(cart,x,1.4,z,.3,1.2,.3,M.red);cyl(cart,x,.6,z,.46,.32,M.black,'x');}
  for(const z of [-C.depth/2,C.depth/2]){rod(cart,[-C.width/2,9.05,z],[C.width/2,9.05,z],.14,M.inox);rod(cart,[-C.width/2-.1,7.1,z*1.02],[C.width/2+.1,7.1,z*1.02],.13,M.steelD);}
  for(const x of [-C.width/2,C.width/2])rod(cart,[x,9.05,-C.depth/2],[x,9.05,C.depth/2],.14,M.inox);
  for(const z of [-22.8,-18.0]){
    box(bed,-18.35,10.3,z,4.5,.6,1,M.inox);
    cyl(bed,-18.1,10,z,.28,4.1,M.steelD,'x');
  }
  // The supplied machine has a fixed KNOLL discharge hopper over its cart.
  // It belongs to the base assembly; only the external coolant units are optional.
  const conveyor=group('KNOLL-chip-conveyor',bed);conveyor.userData.part='lozko';
  const belt=group('inclined-chip-belt',conveyor),flights=[];
  const beltA=new THREE.Vector3(-17.1,3.1,-20.2),beltB=new THREE.Vector3(-18.7,23.8,-20.2),beltD=beltB.clone().sub(beltA),beltLen=beltD.length();
  box(conveyor,-17.6,13.7,-20.2,2.3,21.7,5.2,M.cab2);
  box(conveyor,-18.7,23.8,-20.2,5.4,1.2,5.6,M.cab);
  rod(belt,[-17.1,3.1,-20.2],[-18.7,23.8,-20.2],.95,M.black);
  // Four sheet-metal faces, not a solid cuboid: the mouth is genuinely open.
  const hopper=group('KNOLL-open-discharge-hopper',conveyor);
  M.chute=M.cab.clone();M.chute.side=THREE.DoubleSide;
  const quad=(name,points)=>{const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();const face=new THREE.Mesh(geo,M.chute);face.name=name;face.castShadow=true;face.receiveShadow=true;hopper.add(face);return face;};
  const top=[[-22.1,24.3,-23.1],[-18.5,24.3,-23.1],[-18.5,24.3,-17.3],[-22.1,24.3,-17.3]];
  const mouth=[[-26.3,10.9,-23.1],[-22.7,10.9,-23.1],[-22.7,10.9,-17.3],[-26.3,10.9,-17.3]];
  for(let i=0;i<4;i++)quad(`hopper-wall-${i}`,[top[i],top[(i+1)%4],mouth[(i+1)%4],mouth[i]]);
  rim(hopper,mouth,M.steelD,.055);
  const mouthDatum=group('hopper-open-mouth',hopper);mouthDatum.position.set(-24.5,10.9,-20.2);mouthDatum.userData.opening=[3.6,5.8];
  const plateLabel=label(hopper,'KNOLL',-23.18,21,-20.2,2.8,.65,{rotate:-Math.PI/2,color:'#234e9c',background:'#c9cdd1',size:125});plateLabel.rotation.set(-Math.atan(4.2/13.4),-Math.PI/2,0,'YXZ');
  for(const z of [-22.7,-17.7])box(hopper,-23.55,19.8,z,.18,.23,.37,M.black);
  for(let i=0;i<20;i++){const f=box(belt,0,0,0,.15,.13,4.6,M.steelD);f.rotation.z=-Math.atan2(beltD.x,beltD.y);flights.push(f);}
  let beltPhase=0;
  // Optional units remain off at load. P57 filter is 1523 × 1380 (not 1390).
  const equipment=group('RXU-layout-equipment');equipment.userData.part='lozko';
  const cooling=group('cooling-unit',equipment),filter=group('optional-band-filter',equipment),C0=L.cooling,F=L.filter;
  box(cooling,C0.x,5.5,C0.z,C0.width,10.4,C0.depth,M.cab2);box(cooling,C0.x,10.85,C0.z,C0.width,.2,C0.depth,M.dark);
  for(let i=0;i<17;i++)box(cooling,C0.x,4.1+i*.25,C0.z+C0.depth/2+.02,8,.08,.07,M.dark);
  label(cooling,'COOLING',C0.x,9.9,C0.z+C0.depth/2+.05,3,.45,{color:'#52616b',background:'#c9cdd1',size:60});
  for(const x of [C0.x-2.6,C0.x+2.6]){
    cyl(cooling,x,11.03,C0.z,1.65,.2,M.black);
    for(const radius of [.55,1,1.5]){const guard=new THREE.Mesh(new THREE.TorusGeometry(radius,.028,6,32),M.steelD);guard.rotation.x=-Math.PI/2;guard.position.set(x,11.2,C0.z);cooling.add(guard);}
    for(let i=0;i<8;i++){const a=i*Math.PI/4;rod(cooling,[x,11.2,C0.z],[x+Math.cos(a)*1.6,11.2,C0.z+Math.sin(a)*1.6],.026,M.steelD);}
  }
  const filterPlan=[[-7.615,-6.9],[5.3,-6.9],[5.3,-3.5],[7.615,-3.5],[7.615,2.5],[5.3,2.5],[5.3,4.2],[2.1,4.2],[2.1,6.9],[-1.1,6.9],[-1.1,4.2],[-4.4,4.2],[-4.4,.1],[-7.615,.1]].map(([x,z])=>[x+F.x,z+F.z]);
  footprint(filter,'band-filter-stepped-body',filterPlan,.4,9.8,M.cab2);footprint(filter,'band-filter-lid',filterPlan,10.2,.18,M.inox);
  cyl(filter,F.x,10.5,F.z-2,1.25,.45,M.dark);box(filter,F.x+5,9,F.z,2,3.5,5,M.steelD);
  const hoses=group('coolant-connections',equipment);
  tube(hoses,[[C0.x,2,C0.z+3.8],[C0.x,1.6,-41],[6,2,-37.1]],.13);
  tube(hoses,[[F.x+5,2,F.z+4],[F.x+9,1.5,-40],[6,1.4,-37.1]],.13);
  equipment.visible=false;
  const lampPositions=[[-8.5,24.7,5.4],[2.5,24.7,5.4]];
  lampPositions.forEach(([x,y,z])=>box(cab,x,y,z,.28,.2,3.7,M.lamp));
  const machinePoint=p=>new THREE.Vector3(...p).add(machiningFrame.position);
  return {cab,aG,cG,yG,xG,zG,sp,toolG,buildTool,pockets,magG,driveShaft,saddle,magY,magZ,panG,armPivot,armElbow,hmi,sm:hmi.display,covers:[],clampPins,doors:[door],loadMagazine,machiningFrame,machinePoint,
    lighting:{lampPositions,targets:[[-2.6,PY-.4,3.2],[-2.6,PY-.4,3.2]],bounds:[[-10.65,7.4,-.3],[10.6,27.3,10.7]]},
    accessories:{equipment:{cooling,filter,conveyor},update(c,dt=0){
      equipment.visible=c.accessorySetup!=='none';filter.visible=c.accessorySetup==='filter';hoses.children.forEach((h,i)=>h.visible=i===0||filter.visible);
      if(c.running)beltPhase=(beltPhase+dt*.9)%beltLen;
      flights.forEach((f,i)=>f.position.copy(beltA).addScaledVector(beltD,((i*1.05+beltPhase)%beltLen)/beltLen));
    }},
    updateGeometry({doorK,panelA,panelYaw}){
      door.position.set(L.door.left+doorK*L.door.travel,L.door.bottom,L.door.z);door.rotation.y=0;
      // Sweep out into the operator aisle. The complete monitor stays left of the chassis.
      armPivot.rotation.y=-panelA*.18;armElbow.rotation.y=panelA*.08;panG.rotation.y=panelA*.10+panelYaw;
      covers.forEach(o=>{const {side,index}=o.userData,x=xG.position.x,lo=side<0?-7.4:x+1.9,hi=side<0?x-1.9:7.4,w=Math.max(.1,hi-lo)/9;o.position.x=lo+(index+.5)*w;o.scale.x=w/.4;o.position.y=23.55+index*.025;});
    },
    updateTransfer(change,phase,tls,T){
      const k=!change?0:phase<.3?Math.max(0,(phase-.18)/.12):phase<.4?1:phase<.55?1-(phase-.4)/.15:phase<.7?(phase-.55)/.15:1-(phase-.7)/.3;
      saddle.position.z=-11.8+(transferZ+11.8)*Math.max(0,Math.min(1,k));
      const held=change&&phase>=.4&&phase<.7?(phase<.55?change.from:change.to):0;
      if(held!==transferT){clear(transferTool);transferT=held;const tool=tls.find(t=>t.t===held);if(tool)transferTool.add(createToolModel(tool,M));}
      pockets.forEach((p,i)=>p.visible=i+1!==T&&i+1!==held);
    },
    anchorOverrides:{kabina:()=>new THREE.Vector3(-8.9,26,10.8),lozko:()=>new THREE.Vector3(8,4,11.3),osi:()=>machinePoint([5,24,0]),vreteno:()=>sp.getWorldPosition(new THREE.Vector3()),stol:()=>machinePoint([4.5,PY,0]),zasobnik:()=>magG.getWorldPosition(new THREE.Vector3()),panel:()=>hmi.display.getWorldPosition(new THREE.Vector3()),obrobok:()=>machinePoint([0,PY-.3,0])},
    viewOverrides:{
      celok:()=>[[-36,26,57],[-4,16,-8]],
      vybavenie:()=>[[-65,43,-80],[-9,11,-25]],
      panel:()=>{const p=hmi.display.getWorldPosition(new THREE.Vector3());return [p.clone().add(new THREE.Vector3(-2,2,14)).toArray(),p.toArray()];},
      priestor:()=>[[-8.8,PY+5.2,9.8],[-2.6,PY,3.2],true],
      obrobok:()=>[[-.7,PY+1.4,5.7],[-2.6,PY-.3,3.2],true],
      zasobnik:()=>[[-22,29,-10],[magX,magY,magZ],true],
      zhora:()=>[[-6,140,-21],[-6,8,-21],true],
    },
  };
}
