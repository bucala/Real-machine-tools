import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createHmiPanel } from './hmiPanel';
import { createAccessories } from './accessories';
import { createToolModel } from './toolModel';
import { cabinHalfWidth, hmiPose } from './hermleLayout';

// Dimensions: supplied C32 catalogue pp. 12–13, 34–39; C42 pp. 18–19, 46–50.
// Scene units are 100 mm. Small fittings are reconstructed from catalogue photos.
export const HERMLE_ENVELOPES={
  c32:{width:22.7,depth:36.8,roof:26.6,height:31.9,opening:7.58,tableDepth:5.4,slots:7},
  c42:{width:24.5,depth:40,roof:26.5,height:32.9,opening:9.4,tableDepth:6.3,slots:9},
};

export function createHermleModel({root,G,M,tex,MC,PY}) {
  const P=HERMLE_ENVELOPES[MC.id], K=MC.K, bodyHalf=cabinHalfWidth(MC), PY0=PY, U=.01, FIX={r:35,h:50};
  const std=(col,rough=.5,metal=.2,extra={})=>new THREE.MeshStandardMaterial({color:new THREE.Color(col).convertSRGBToLinear(),roughness:rough,metalness:metal,...extra});
  const v3=(x,y,z)=>new THREE.Vector3(x,y,z);
    const grp = (k, parent = root) => { const g = new THREE.Group(); g.userData.part = k; parent.add(g); G[k] = g; return g; };
    const box = (p, xa, xb, y0, y1, z0, z1, m) => { const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb); const me = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m); me.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); me.castShadow = true; me.receiveShadow = true; p.add(me); return me; };
    const cylY = (p, r0, r1, y0, y1, x, z, m, s = 32) => { const me = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, y1 - y0, s), m); me.position.set(x, (y0 + y1) / 2, z); me.castShadow = true; p.add(me); return me; };
    const cylX = (p, r, xa, xb, y, z, m, s = 40) => { const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb); const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, x1 - x0, s), m); me.rotation.z = Math.PI / 2; me.position.set((x0 + x1) / 2, y, z); me.castShadow = true; p.add(me); return me; };
    const sc = (parent) => { const g = new THREE.Group(); g.scale.setScalar(K); parent.add(g); return g; };
    M.win = std(0x1d2329, 0.15, 0.4); M.yellow = std(0xf2c230, 0.5, 0.1); M.brush = std(0xc2c6ca, 0.38, 0.7);
    // A folded sheet or cast profile, extruded along Z; real edges catch the light.
    const profile=(parent,points,z,depth,mat,bevel=0)=>{
      const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
      const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:3,curveSegments:32}),mat);
      mesh.position.z=z;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
    };
    const rod=(parent,a,b,r,mat)=>{const delta=v3(...b).sub(v3(...a)),mesh=cylY(parent,r,r,0,delta.length(),0,0,mat,12);mesh.position.copy(v3(...a).add(v3(...b)).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(v3(0,1,0),delta.normalize());return mesh;};
    const bolts=(parent,positions,r=.045,axis='z')=>{
      const mesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(r,r,.035,6),M.steelD,positions.length);
      const q=new THREE.Quaternion().setFromAxisAngle(v3(axis==='z'?1:0,0,axis==='x'?1:0),axis==='y'?0:Math.PI/2);
      positions.forEach((p,i)=>mesh.setMatrixAt(i,new THREE.Matrix4().compose(v3(...p),q,v3(1,1,1))));parent.add(mesh);return mesh;
    };
    const face=(parent,texture,w,h,x,y,z,ry=0)=>{const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:texture,roughness:.55}));mesh.position.set(x,y,z);mesh.rotation.y=ry;parent.add(mesh);return mesh;};
    // ---------------- lôžko z minerálneho liatia a steny s vedeniami Y ----------------
    const bed = sc(grp('lozko')); bed.scale.y=1;
    [[-8.6, -9.6], [8.6, -9.6], [-8.6, 7.4], [8.6, 7.4]].forEach(([x, z]) => box(bed, x - 0.9, x + 0.9, 0, 0.7, z - 0.9, z + 0.9, M.black));
    const bedHalf=Math.min(10,bodyHalf/K-.1);
    box(bed, -bedHalf, bedHalf, 0.7, 6.2, -12.5, 8.0/K, M.dark);
    [-1, 1].forEach((s) => {
      const wall=profile(bed,[[-7.8/K,6.2],[-7.8/K,14.6],[-3.2,20.8],[12.3,20.8],[12.5,6.2]],0,2.7,M.anth);
      wall.name='mineral-cast-bed-cheek';wall.rotation.y=Math.PI/2;wall.position.x=s*6.9;wall.scale.z=s;                                    // stena lôžka
      box(bed, s * 7.6, s * 8.6, 20.8, 21.2, -11, 3.2, M.steelD);                                  // vedenie Y
      cylX(bed, 2.1, s * 6.4, s * 6.9, PY0, 0, M.table, 48);                                      // príruba osi A
      const motorOuter=Math.min(10.6,bodyHalf/K-.2);
      if(MC.id==='c42'||s>0)cylX(bed, 1.2, s * (motorOuter-.8), s * motorOuter, PY0, 0, M.steelD, 32);                                    // pohon osi A (tandem)
    });
    box(bed, -6.9, 6.9, 4.5, 4.65, -12.5, 7.8/K, M.inox);                                               // dno pracovného priestoru (nerez)
    box(bed, -6.9, 6.9, 7.2, 19, -12.4, -12.2, M.inox);                                              // zadná stena
    box(bed, -6.9, 6.9, 6.3, 13.3, -3.55, -3.4, M.inox);
    for(const sign of [-1,1])box(bed,sign*2.3,sign*6.9,13.3,18.8,-3.55,-3.4,M.inox);
    for(const x of [-6.5,-2.6,2.6,6.5])bolts(bed,[[x,13.6,-3.38],[x,18.5,-3.38]],.05);                                           // deliaca stena pred zásobníkom
    // Rear service/electrical section completes the 4000 mm C42 plan envelope.
    const service = sc(bed.parent), envelopeScale = bodyHalf / 12.25;
    const serviceRear = (8.9-P.depth)/K, serviceFront = -12.4;
    service.scale.y=1;
    const serviceHalf = 8.75*envelopeScale/K;
    box(service,-serviceHalf,serviceHalf,1.2,21.5*envelopeScale/K,serviceRear,serviceFront,M.cab2);
    box(service,-serviceHalf+.2,serviceHalf-.2,1,1.2,serviceRear+.2,serviceFront-.2,M.dark);
    for(const x of [-serviceHalf*.8,serviceHalf*.8])for(const z of [serviceRear+.6,serviceFront-.6])cylY(service,.4,.4,.05,1.2,x,z,M.steelD);
    for(const x of [-serviceHalf*.5,serviceHalf*.5]){
      box(service,x-serviceHalf*.48,x+serviceHalf*.48,2,20.7*envelopeScale/K,serviceRear-.08,serviceRear-.02,M.cab);
      box(service,x+.8,x+.9,10,11,serviceRear-.18,serviceRear-.08,M.black);
    }
    for(const sign of (MC.id==='c42'?[-1,1]:[1])){
      box(bed,sign*9.55,sign*Math.min(10.15,bodyHalf/K-.3),PY-1,PY+1,-.9,.9,M.cab2);
      for(let i=0;i<7;i++)box(bed,sign*9.6,sign*Math.min(10.1,bodyHalf/K-.3),PY-.9+i*.25,PY-.85+i*.25,-.94,-.9,M.steelD);
    }
    const accessories = createAccessories(root, M, K, bodyHalf);
    // Cast U cradle, paired A bearings and the flattened, parallel-slot table.
    const tab=grp('stol'), aG=new THREE.Group();aG.position.set(0,PY,0);tab.add(aG);
    const r=MC.table*.005, bearingX=6.4*K;
    // Lofted casting: broad lower pan under C, narrow rising arms at the A
    // bearings. A full-depth extrusion makes the ears into unrealistic blocks.
    const castPositions=[],castIndices=[],rings=80,segments=32,outer=bearingX-.3;
    for(let i=0;i<=rings;i++){
      const x=-outer+2*outer*i/rings,u=THREE.MathUtils.clamp((Math.abs(x)-(r+1.4))/(outer-r-1.4),0,1),t=u*u;
      const cy=THREE.MathUtils.lerp(-MC.hA*U-1.3,-.05,t),hy=THREE.MathUtils.lerp(.75,1.05,t),hz=THREE.MathUtils.lerp(P.tableDepth/2+.25,.68,t);
      // Rounded rectangular sections; the pan front is machined only at its label.
      const corner=.28;
      for(let j=0;j<segments;j++){
        const quadrant=Math.floor(j/8),angle=(quadrant*90+(j%8)*90/7)*Math.PI/180;
        const sy=quadrant<2?1:-1,sz=quadrant===0||quadrant===3?1:-1;
        castPositions.push(x,cy+sy*(hy-corner)+Math.sin(angle)*corner,sz*(hz-corner)+Math.cos(angle)*corner);
      }
    }
    for(let i=0;i<rings;i++)for(let j=0;j<segments;j++){
      const a=i*segments+j,b=i*segments+(j+1)%segments,c=a+segments,d=b+segments;
      castIndices.push(a,c,b,b,c,d);
    }
    for(const end of [0,rings]){
      const centre=castPositions.length/3;castPositions.push(end===0?-outer:outer,-.05,0);
      for(let j=0;j<segments;j++){const a=end*segments+j,b=end*segments+(j+1)%segments;castIndices.push(...(end===0?[centre,a,b]:[centre,b,a]));}
    }
    const casting=new THREE.BufferGeometry();casting.setAttribute('position',new THREE.Float32BufferAttribute(castPositions,3));casting.setIndex(castIndices);casting.computeVertexNormals();
    const bowl=new THREE.Mesh(casting,std(0x9ca4aa,.38,.55));bowl.name='cast-A-cradle';bowl.castShadow=true;bowl.receiveShadow=true;aG.add(bowl);
    for(const sign of [-1,1]){
      cylX(aG,2.25,sign*(bearingX-.28),sign*(bearingX+.05),0,0,M.steelD,96);
      cylX(aG,2.12,sign*(bearingX-.36),sign*(bearingX-.27),0,0,M.table,96);
      cylX(aG,1.74,sign*(bearingX-.4),sign*(bearingX-.35),0,0,M.steelD,96);
      cylX(aG,1.64,sign*(bearingX-.44),sign*(bearingX-.39),0,0,M.table,96);
      cylX(aG,.58,sign*(bearingX-.56),sign*(bearingX-.43),0,0,M.table,48);
      const flange=new THREE.Mesh(new THREE.TorusGeometry(2.18,.055,8,96),M.steel);flange.rotation.y=Math.PI/2;flange.position.x=sign*(bearingX-.38);aG.add(flange);
      bolts(aG,Array.from({length:24},(_,i)=>[sign*(bearingX-.4),1.97*Math.sin(i*Math.PI/12),1.97*Math.cos(i*Math.PI/12)]),.055,'x');
      const padX=sign*(outer-.08);box(aG,padX-.14,padX+.14,.6,.94,.68,.74,M.cab2);bolts(aG,[[padX,.78,.77]],.05);
      for(const y of [.75,-.75])box(aG,sign*(bearingX-.64),sign*(bearingX-.47),y-.12,y+.12,-.16,.16,M.steel);
    }
    box(aG,-.18,.18,-2.9,-2.55,P.tableDepth/2+.36,P.tableDepth/2+.4,M.cab2);
    bolts(aG,[[0,-2.72,P.tableDepth/2+.43]],.05);
    const cG=new THREE.Group();cG.position.y=-MC.hA*U;aG.add(cG);
    cylY(cG,r-.25,r-.25,-.55,-.24,0,0,M.steelD,80);
    const outline=new THREE.Shape(),halfDepth=P.tableDepth/2;
    const outlinePts=[];
    for(let i=0;i<=160;i++){const a=i/160*Math.PI*2;outlinePts.push([Math.cos(a)*r,Math.max(-halfDepth,Math.min(halfDepth,Math.sin(a)*r))]);}
    outlinePts.forEach(([x,z],i)=>i?outline.lineTo(x,z):outline.moveTo(x,z));outline.closePath();
    for(let i=0;i<P.slots;i++){
      const z=(i-(P.slots-1)/2)*.7,extent=Math.sqrt(r*r-z*z)-.04,slot=new THREE.Path();
      slot.moveTo(-extent,z-.07);slot.lineTo(-extent,z+.07);slot.lineTo(extent,z+.07);slot.lineTo(extent,z-.07);slot.closePath();outline.holes.push(slot);
      box(cG,-extent,extent,-.245,-.225,-z-.09,-z+.09,M.black);
    }
    const tdisc=new THREE.Mesh(new THREE.ExtrudeGeometry(outline,{depth:.22,bevelEnabled:false,curveSegments:80}),M.table);
    tdisc.name='parallel-slot-clamping-table';tdisc.rotation.x=-Math.PI/2;tdisc.position.y=-.22;tdisc.castShadow=true;tdisc.receiveShadow=true;cG.add(tdisc);
    bolts(cG,[[-r*.65,.025,-1.05],[r*.65,.025,-1.05],[-r*.65,.025,1.05],[r*.65,.025,1.05]],.06,'y');
    cylY(cG, FIX.r * U * 1.35, FIX.r * U * 1.35, 0, 0.22, 0, 0, M.steelD, 40);                     // nulový upínací systém
    cylY(cG, FIX.r * U, FIX.r * U, 0.22, FIX.h * U, 0, 0, M.anth, 40);
    const clampPins = [0,1,2].map(i=>{
      const pin=new THREE.Group();pin.rotation.y=i*Math.PI*2/3;cG.add(pin);
      return box(pin,-.055,.055,.25,.42,FIX.r*U-.06,FIX.r*U+.06,M.steel);
    });
    // ---------------- portál: priečnik Y, sane X, smykadlo Z, vreteno ----------------
    const ax = grp('osi');
    const yG = new THREE.Group(); ax.add(yG);
    const yS = sc(yG); yS.scale.y=1;
    box(yS, -8.8, 8.8, 21.2, 23.0, -1.7, 1.7, M.cab2);                                             // priečnik Y
    box(yS, -8.8, 8.8, 23.0, 23.1, -1.7, 1.7, M.steelD);
    for(const y of [20.6,22.4])box(yS,-8.4,8.4,y,y+.15,1.73,1.89,M.steel);
    const guideBolts=[];for(const y of [20.68,22.48])for(let x=-8;x<=8;x+=.8)guideBolts.push([x,y,1.91]);bolts(yS,guideBolts,.035);
    // Short trapezoidal stainless accordion shields follow the brochure cutaway.
    // Every fold has depth; the outer edges taper inward toward the lower rail.
    const covers=[],bellows=[];
    for(const sign of [-1,1]){
      const folds=48,positions=new Float32Array((folds+1)*6),uv=new Float32Array((folds+1)*4),indices=[];
      for(let i=0;i<=folds;i++){uv.set([i/folds,0,i/folds,1],i*4);if(i<folds){const n=i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}}
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setIndex(indices);
      const mesh=new THREE.Mesh(geo,M.inox);mesh.name=sign<0?'left-trapezoid-bellows':'right-trapezoid-bellows';mesh.castShadow=true;mesh.receiveShadow=true;yS.add(mesh);bellows.push({mesh,sign,folds});
      profile(yS,[[sign*8.7,23.12],[sign*8.5,23.12],[sign*6.73,17.04],[sign*6.94,17.04]],1.79,.19,M.steelD);
      rod(yS,[sign*8.57,23.1,2.01],[sign*6.84,17.16,2.01],.045,M.steel);
    }
    box(yS,-8.9,8.9,23.07,23.65,1.68,2.12,M.cab2);
    box(yS,-6.95,6.95,16.95,17.2,1.68,2.12,M.inox);
    box(yS,-6.95,6.95,16.78,16.95,1.7,1.89,M.steelD);
    bolts(yS,[-8.5,-4.5,0,4.5,8.5].map(x=>[x,23.38,2.14]),.04);
    bolts(yS,[-6.5,-3.2,0,3.2,6.5].map(x=>[x,17.08,2.14]),.04);
    const xG = new THREE.Group(); yG.add(xG);
    const xS = sc(xG); xS.scale.y=1;
    box(xS, -1.45, 1.45, 20.0, 23.6, -2.0, .85, M.cab);
    for(const x of [-1.65,1.65])for(const y of [20.4,22.25])box(xS,x-.25,x+.25,y,y+.5,1.35,1.55,M.steelD);                                              // sane X
    const zG = new THREE.Group(); xG.add(zG);
    const zS = sc(zG); zS.scale.setScalar(1); zS.position.z=2.25*K-1.92;
    box(zS, -1.25, 1.25, 0.9, 13.0, -1.25, 1.9, M.inox);                                          // smykadlo Z (počiatok = čelo vretena)
    const sp = grp('vreteno', zG);
    cylY(sp, 0.78, 0.78, 0.05, 0.9 * K, 0, 0, M.steel, 40);
    cylY(sp, 0.55, 0.78, 0, 0.05, 0, 0, M.steelD, 40);
    for (const y of [.2, .45, .7]) cylY(sp, .8, .8, y, y + .035, 0, 0, M.steelD);
    for (const x of [-.98, .98]) {
      cylY(sp, .12, .12, .55, 1.3, x, 0, M.red, 16);
      cylY(sp, .19, .19, 1.3, 1.5, x, 0, M.steelD, 16);
      box(sp, x - .18, x + .18, 1.5, 1.75, -.18, .18, M.anth);
    }
    const toolG = new THREE.Group(); sp.add(toolG);
    const clearTool = (g) => { while (g.children.length) { const o = g.children[0]; g.remove(o); o.traverse((n) => n.geometry?.dispose()); } };
    const buildTool = (t) => { clearTool(toolG); if (t) toolG.add(createToolModel(t, M)); };
    // Pick-up carousel integrated in the rear bed: windowed drum, perimeter
    // pockets and a SIDE drive. The long guide assembly sits over the carrier;
    // it is not a fictitious drive shaft through the centre of the linear rails.
    const mag=grp('zasobnik'), magS=sc(mag);
    const magZ=-MC.tcY*U/K-4,magY=(PY+(MC.nose[1]-80)*U)/K;
    const drum=new THREE.Group();drum.name='magazine-support-drum';drum.position.set(0,magY-2.3,magZ);magS.add(drum);
    cylY(drum,3.62,3.62,-.22,0,0,0,M.anth,96);
    cylY(drum,3.62,3.62,1.83,2.03,0,0,M.anth,96);
    for(let i=0;i<12;i++){
      const bay=new THREE.Group();bay.rotation.y=i*Math.PI/6;drum.add(bay);
      box(bay,-.22,.22,0,1.85,3.13,3.58,M.anth);
      // Recessed inner wall leaves visible inspection pockets between the ribs.
      box(bay,-.6,.6,.18,1.65,2.85,2.92,M.black);
      bolts(bay,[[-.05,.15,3.6],[-.05,1.7,3.6]],.055);
    }
    for(const sign of [-1,1]){
      box(magS,sign*3.7-.35,sign*3.7+.35,6.3/K,magY-2.45,magZ-2,magZ+2,M.anth);
      box(magS,sign*3.7-.65,sign*3.7+.65,6.3/K,6.55/K,magZ-2.3,magZ+2.3,M.steelD);
    }
    const magG=new THREE.Group();magG.name='indexed-tool-carousel';magG.position.set(0,magY,magZ);magS.add(magG);
    cylY(magG,3.8,3.8,-.25,-.09,0,0,M.steelD,96);
    const race=new THREE.Mesh(new THREE.TorusGeometry(3.8,.11,10,128),M.red);race.rotation.x=Math.PI/2;race.position.y=-.025;magG.add(race);
    const innerRace=new THREE.Mesh(new THREE.TorusGeometry(3.57,.035,8,128),M.black);innerRace.rotation.x=Math.PI/2;innerRace.position.y=.005;magG.add(innerRace);
    const pockets=[];
    for(let i=0;i<MC.mag;i++){
      const a=i/MC.mag*Math.PI*2,g=new THREE.Group();g.name=`magazine-pocket-${i+1}`;g.position.set(Math.sin(a)*4,0,Math.cos(a)*4);g.rotation.y=a;magG.add(g);
      // Moulded red saddle with a U-shaped jaw around the HSK flange groove.
      box(g,-.26,.26,-.2,-.08,-.48,-.24,M.red);
      for(const sign of [-1,1]){
        profile(g,[[sign*.19,-.15],[sign*.27,-.15],[sign*.3,.04],[sign*.21,.04]],-.27,.59,M.red);
        box(g,sign*.19,sign*.26,-.05,.02,.15,.35,M.red);
      }
      box(g,-.13,.13,-.38,-.2,-.46,-.2,M.steelD);
      bolts(g,[[-.16,-.06,-.37],[.16,-.06,-.37]],.032,'y');
      const holder=new THREE.Group();holder.scale.setScalar(1/K);g.add(holder);pockets.push(holder);
    }
    // Small gear teeth on the ring mesh with the outboard pinion, under its cover.
    for(let i=0;i<84;i++){
      const a=i*Math.PI/42,g=new THREE.Group();g.rotation.y=a;magG.add(g);box(g,-.04,.04,-.24,-.08,3.78,3.94,M.red);
    }
    const driveShaft=new THREE.Group();driveShaft.name='carousel-side-pinion';driveShaft.position.set(-4.22,magY,magZ-.85);magS.add(driveShaft);
    cylY(driveShaft,.16,.16,-.6,.9,0,0,M.steel);
    cylY(driveShaft,.45,.45,-.23,-.08,0,0,M.steelD);
    for(let i=0;i<16;i++){const g=new THREE.Group();g.rotation.y=i*Math.PI/8;driveShaft.add(g);box(g,-.045,.045,-.23,-.08,.39,.49,M.steelD);}
    const drive=new THREE.Group();drive.name='carousel-side-drive-cover';drive.position.set(-4.22,magY+.75,magZ-.85);magS.add(drive);
    const cap=profile(drive,[[-.62,-.45],[-.5,-1.95],[.25,-2.2],[.7,-1.8],[.62,.15],[.25,.6],[-.3,.55]],0,.13,M.red,.045);cap.rotation.x=Math.PI/2;
    for(const z of [0,-1.65]){
      cylY(drive,.25,.25,-.16,.045,0,z,M.steel);
      cylY(drive,.15,.15,.045,.07,0,z,M.steelD);
    }
    cylY(drive,.42,.42,-1.55,-.2,0,-1.65,M.anth);
    box(magS,-4.9,-3.8,magY-2.1,magY-1.85,magZ-3.1,magZ-.1,M.anth);
    box(magS,-4.48,-4.03,magY-1.85,magY-.55,magZ-2.8,magZ-.7,M.anth);
    bolts(magS,[[-4.65,magY-1.82,magZ-2.85],[-4.65,magY-1.82,magZ-.4]],.065,'y');
    // Long raised guide base: faceted cast platform, two bright rails and screw.
    const saddle=new THREE.Group();saddle.name='magazine-guide-bridge';saddle.position.set(0,magY+.08,magZ);magS.add(saddle);
    profile(saddle,[[-1.9,0],[1.9,0],[1.9,.4],[1.55,.7],[-1.55,.7],[-1.9,.4]],-4.1,6.75,M.anth,.06);
    const rodZ=(x,y,z0,z1,r,mat)=>rod(saddle,[x,y,z0],[x,y,z1],r,mat);
    for(const sign of [-1,1]){
      box(saddle,sign*.9,sign*1.25,.7,.92,-3.85,2.45,M.steel);
      box(saddle,sign*1.35,sign*1.44,.69,.73,-3.8,2.42,M.steelD);
      bolts(saddle,Array.from({length:10},(_,i)=>[sign*1.07,.94,-3.6+i*.6]),.04,'y');
    }
    rodZ(0,1.06,-3.7,2.4,.13,M.steelD);
    for(let i=0;i<49;i++){
      const ring=new THREE.Mesh(new THREE.TorusGeometry(.137,.017,4,12),M.steel);ring.position.set(0,1.06,-3.6+i*.123);saddle.add(ring);
    }
    for(const z of [-3.85,2.5]){
      box(saddle,-1.65,1.65,.65,1.7,z-.15,z+.15,M.cab2);
      for(const x of [-1.07,0,1.07])rodZ(x,1.07,z-.17,z+.17,.23,M.steelD);
      bolts(saddle,[[-1.42,.85,z+.18],[1.42,.85,z+.18],[-1.42,1.48,z+.18],[1.42,1.48,z+.18]],.05);
    }
    box(saddle,-.53,.53,.8,1.65,-4.15,-4.04,M.anth);
    rodZ(0,1.1,-4.06,-3.85,.2,M.steel);
    const guideCarriage=box(saddle,-1.5,1.5,.92,1.32,-3.8,-2.7,M.steelD);guideCarriage.name='linear-guide-carriage';
    const loadMagazine = (tls) => pockets.forEach((g, i) => { clearTool(g); const tl = tls.find((x) => x.t === i + 1); if (tl) g.add(createToolModel(tl, M)); });
    // Thin enclosure panels: solid side service doors, not enormous side windows.
    const cab=grp('kabina'), cabS=new THREE.Group();cab.add(cabS);cab.add(service);
    const front=8.6, rear=-12.3*K, opening=P.opening, leaf=opening/2+.12, half=opening/2;
    const logo=tex(768,192,(g,w,h)=>{g.fillStyle='#e6e8ea';g.fillRect(0,0,w,h);g.strokeStyle='#d8202a';g.lineWidth=24;g.beginPath();g.arc(90,96,61,.45,Math.PI*2-.45);g.stroke();g.fillStyle='#6b7277';g.font='bold 85px sans-serif';g.textBaseline='middle';g.fillText('HERMLE',165,100);});
    const modelLabel=tex(128,768,(g,w,h)=>{g.fillStyle='#bbc0c4';g.fillRect(0,0,w,h);g.fillStyle='#ce1228';g.fillRect(46,255,37,490);g.save();g.translate(64,125);g.rotate(-Math.PI/2);g.fillStyle='#596168';g.font='44px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(MC.name,0,0);g.restore();});
    const ventTexture=tex(128,256,(g,w,h)=>{g.fillStyle='#c9cdd1';g.fillRect(0,0,w,h);g.fillStyle='#252b30';for(let y=5;y<h;y+=12)for(let x=6;x<w;x+=13)g.fillRect(x,y,6,7);});
    const sideLength=front-rear;
    for(const sign of [-1,1]){
      const wall=new THREE.Group();wall.position.x=sign*bodyHalf;wall.rotation.y=sign*Math.PI/2;cabS.add(wall);
      // Local X runs along the machine side; panel breaks and recessed locks.
      box(wall,-sideLength/2,sideLength/2,1.2,P.roof,-.22,0,M.cab);
      wall.position.z=(front+rear)/2;
      for(const y of [8.4,17.1])box(wall,-sideLength/2+.1,sideLength/2-.1,y,y+.025,.005,.012,M.steelD);
      for(const x of [-sideLength*.28,sideLength*.25]){
        box(wall,x,x+.025,1.4,17.1,.005,.012,M.steelD);
        box(wall,x+.25,x+.39,10.3,10.9,.01,.08,M.steelD);
        for(const y of [3,14.6])box(wall,x-.11,x+.07,y,y+.38,.01,.1,M.cab2);
      }
      face(wall,logo.tx,3.2,.8,0,19.5,.025);
      bolts(wall,[[-sideLength/2+.3,1.6,.04],[sideLength/2-.3,1.6,.04],[-sideLength/2+.3,25.6,.04],[sideLength/2-.3,25.6,.04]]);
      // Narrow chamfer-like fascia and grey lower skirt.
      box(cabS,sign*half,sign*bodyHalf,1.2,P.roof,front-.25,front,M.cab);
      profile(cabS,[[sign*half,4],[sign*bodyHalf,4],[sign*bodyHalf,7.4],[sign*half,7.4]],front+.015,.07,M.anth);
      box(cabS,sign*(half+.05),sign*(bodyHalf-.05),1.4,3.9,front+.02,front+.07,M.cab2);
    }
    // Side heat exchanger: perforated folded cover beside the swivel terminal.
    box(cabS,bodyHalf,bodyHalf+1,3.8,12.5,2.7,5.5,M.cab2);
    face(cabS,ventTexture.tx,2.35,8,bodyHalf+1.015,8.1,4.1,Math.PI/2);
    const ventTop=face(cabS,ventTexture.tx,1,2.7,bodyHalf+.5,12.515,4.1);ventTop.rotation.x=-Math.PI/2;
    box(cabS,-bodyHalf,bodyHalf,1.1,1.35,rear,front+.45,M.cab2);
    box(cabS,-half,half,1.35,6.6,front-.15,front-.05,M.cab2);
    for(const y of [1.8,2.5,3.3,4.1,5.6,6.2])box(cabS,-half,half,y,y+.045,front-.04,front+.01,M.steelD);
    bolts(cabS,[-half+.18,0,half-.18].flatMap(x=>[1.8,3.3,6.2].map(y=>[x,y,front+.03])));
    box(cabS,-bodyHalf,bodyHalf,P.roof-.35,P.roof,front-.55,front+.12,M.cab);
    box(cabS,-bodyHalf,bodyHalf,1.2,P.roof,rear-.2,rear,M.cab);
    // Roof with a real aperture for the travelling ram and recessed concertina covers.
    for(const sign of [-1,1])box(cabS,sign*6.5,sign*bodyHalf,P.roof-.3,P.roof,rear,front,M.cab);
    box(cabS,-6.5,6.5,P.roof-.3,P.roof,6.5,front,M.cab);
    box(cabS,-6.5,6.5,P.roof-.3,P.roof,rear,-10.8,M.cab);
    for(const sign of [-1,1])box(cabS,sign*(bodyHalf-.15),sign*bodyHalf,P.roof,P.roof+.15,rear,front,M.cab2);
    face(cabS,logo.tx,3.6,.9,-bodyHalf+2.2,18.8,front+.035);
    // Upper door guide, drive belt, rollers, safety interlock and lower sill.
    for(const y of [1.55,P.roof-.65]){
      box(cabS,-bodyHalf+.4,bodyHalf-.4,y-.14,y+.14,front+.08,front+.32,M.steelD);
      box(cabS,-bodyHalf+.4,bodyHalf-.4,y+.02,y+.08,front+.325,front+.36,M.steel);
    }
    for(let row=0;row<3;row++)box(cabS,-half,half,1.8+row*.34,2.05+row*.34,front-.15,front+.27,M.steel);
    box(cabS,-half,half,7.15,7.3,front-.9,front-.15,M.steel);
    box(cabS,half+.25,half+1.25,P.roof-.45,P.roof+.02,front-.2,front+.2,M.red);
    box(cabS,half-.15,half+.15,P.roof-.8,P.roof-.55,front+.35,front+.55,M.black);
    const doors=[-1,1].map(sign=>{
      const d=new THREE.Group();d.name=sign<0?'left-sliding-door':'right-sliding-door';cabS.add(d);d.userData.s=sign;
      const w=leaf/2, windowW=leaf*.53, bottom=2.65, top=P.roof-.95, wy0=8.2,wy1=19.8;
      box(d,-w,w,bottom,wy0,-.14,.14,M.cab);box(d,-w,w,wy1,top,-.14,.14,M.cab);
      for(const side of [-1,1])box(d,side*windowW/2,side*w,wy0,wy1,-.14,.14,M.cab);
      // Recessed rubber glazing seal surrounds a real transparent opening.
      for(const side of [-1,1])box(d,side*(windowW/2-.035),side*(windowW/2+.045),wy0,wy1,-.15,-.09,M.black);
      for(const y of [wy0,wy1])box(d,-windowW/2,windowW/2,y-.035,y+.035,-.15,-.09,M.black);
      const glass=new THREE.Mesh(new THREE.PlaneGeometry(windowW-.07,wy1-wy0-.08),M.glass);glass.name='door-safety-glass';glass.position.set(0,(wy0+wy1)/2,-.11);d.add(glass);
      if(sign>0)face(d,modelLabel.tx,.55,9.9,0,13.4,-.105);
      profile(d,[[-w,4.5],[w,4.5],[w,7.9],[-w,7.9]],.15,.035,M.anth);
      box(d,-w,w,2.65,4.5,.15,.19,M.cab2);
      const hx=-sign*(w-.22),points=[[hx,8.5,.2],[hx+sign*.36,9.2,.57],[hx+sign*.36,11.8,.57],[hx,12.5,.2]];
      for(let j=1;j<points.length;j++)rod(d,points[j-1],points[j],.09,M.red);
      for(const y of [8.5,12.5]){box(d,hx-.13,hx+.13,y-.15,y+.15,.14,.28,M.black);bolts(d,[[hx,y,.29]]);}
      for(const y of [bottom+.3,top-.3])for(const x of [-w+.25,w-.25]){
        const roller=cylY(d,.12,.12,-.04,.04,0,0,M.steel);roller.rotation.x=Math.PI/2;roller.position.set(x,y,-.2);
      }
      box(d,-sign*w-.025,-sign*w+.025,bottom,top,-.16,.16,M.black);
      if(sign<0)face(d,logo.tx,1.1,.275,0,8.01,.155);
      bolts(d,[[-w+.12,bottom+.15,.2],[w-.12,bottom+.15,.2],[-w+.12,top-.15,.2],[w-.12,top-.15,.2]]);
      return d;
    });
    // ---------------- ovládací panel TNC 640 (Hermle) na otočnom ramene ----------------
    const pan = grp('panel');
    const panBase = new THREE.Group();pan.add(panBase);
    // Two low articulated links. The machine-side pivot is at the FRONT corner.
    const hmiBase = hmiPose(0, 0, bodyHalf, 1);
    box(panBase, bodyHalf-.1,hmiBase.base[0],2.9,4.3,7.05,7.95,M.anth);
    cylY(panBase,.65,.65,2.7,4.7,hmiBase.base[0],7.5,M.steelD);
    const armPivot = new THREE.Group(); armPivot.position.set(hmiBase.base[0],0,7.5); panBase.add(armPivot);
    // Offset links and forked elbow: the folded arm has clearance between its two members.
    box(armPivot,-.48,.48,3.2,4.05,0,4.6,M.anth);
    box(armPivot,-.52,.52,4.05,4.16,.4,4.2,M.steelD);
    const armElbow = new THREE.Group(); armElbow.position.z=4.6; armPivot.add(armElbow);
    cylY(armElbow,.68,.68,3.85,4.95,0,0,M.steelD);
    box(armElbow,-.42,.42,4.35,5.05,0,6.8,M.anth);
    const brace=new THREE.Mesh(new THREE.BoxGeometry(.7,3.95,.7),M.anth);
    brace.position.set(0,6.8,6.02);brace.rotation.x=.42;armElbow.add(brace);
    cylY(armElbow,.38,.38,2.4,9.45,0,6.8,M.anth);
    cylY(armElbow,.55,.55,4.25,5.2,0,6.8,M.steelD);
    const panG = new THREE.Group(); panG.position.set(0,0,6.8); armElbow.add(panG);
    const hmi = createHmiPanel(panG,M,tex), sm = hmi.display;
    // Folded stainless chip troughs, linear guide shoes and fastened ram panels.
    for(const sign of [-1,1]){
      profile(bed,[[sign*3.9,5.6],[sign*6.9,7.5],[sign*6.9,7.62],[sign*3.9,5.72]],-3.1,8.05/K+3.1,M.inox);
      box(bed,sign*3.85,sign*4.35,5.5,5.62,-3.1,8.05/K,M.dark);
      const lining=box(bed,sign*6.65,sign*6.78,7.4,19.9,-3.3,3.2,M.inox);lining.name='stainless-workspace-lining';
      for(const z of [-.95,.95])box(yS,sign*7.45,sign*8.7,20.7,21.35,z-.4,z+.4,M.steelD);
      for(const y of [3,6,9,11.8])bolts(zS,[[sign*1.1,y,1.93]],.04);
      rod(sp,[sign*.72,1.2,.5],[sign*.68,.3,.75],.055,M.black);
      cylY(sp,.085,.06,.15,.3,sign*.68,.75,M.steel);
    }
    box(zS,-1.25,1.25,7.1,7.16,1.901,1.94,M.steelD);
    box(zS,-1.22,1.22,1.05,7.05,1.9,1.92,M.cab2);
    box(zS,-1.22,1.22,7.22,12.8,1.9,1.92,M.cab2);
    // Upper Z motor cap and cable carrier follow X/Y; Z ram slides through it.
    box(xS,-1.6,1.6,P.roof-.1,P.height-2.2,-1.65,1.4,M.cab);
    box(xS,-2.4,2.4,P.height-2.2,P.height,-1.8,2.1,M.cab2);
    bolts(xS,[[-2.1,P.height-.25,2.12],[2.1,P.height-.25,2.12],[-2.1,P.height-1.9,2.12],[2.1,P.height-1.9,2.12]]);
    const cableChain=new THREE.Group();cableChain.name='Z-cable-carrier';xS.add(cableChain);
    const curve=new THREE.CatmullRomCurve3([v3(0,P.height-.05,-1.2),v3(0,P.height-.1,-2.4),v3(0,P.roof+1.6,-6.5),v3(0,P.roof+.3,-6.1)]);
    for(let i=0;i<28;i++){const mesh=box(cableChain,-.65,.65,-.17,.17,-.22,.22,M.black);mesh.position.copy(curve.getPoint(i/27));mesh.quaternion.setFromUnitVectors(v3(0,1,0),curve.getTangent(i/27).normalize());}
    // Roof bellows move with the crossbeam, staying attached at front/rear.
    const roofCovers=[0,1].map(()=>{const mesh=box(cabS,-6.5,6.5,-.09,.09,-.5,.5,M.anth);mesh.position.y=P.roof-.22;return mesh;});
    M.lamp=std(0xffffff,.3,0,{emissive:0xffffff,emissiveIntensity:.5});
    for(const sign of [-1,1]){
      box(cabS,sign*5.2-.24,sign*5.2+.24,20.4,20.7,-1.8,3.6,M.steelD);
      box(cabS,sign*5.2-.17,sign*5.2+.17,20.35,20.4,-1.6,3.4,M.lamp);
    }
    // Rear service doors, louvres, main isolator and utility couplings.
    const rearWorld=8.9-P.depth;
    for(const sign of [-1,1]){
      const panel=new THREE.Group();panel.position.set(sign*4.2,0,rearWorld-.12);panel.rotation.y=Math.PI;cab.add(panel);
      face(panel,ventTexture.tx,2.9,2.2,0,5,.025);
      bolts(panel,[[-3.7,2,.025],[3.7,2,.025],[-3.7,19,.025],[3.7,19,.025]]);
      if(sign>0){box(panel,-.4,.4,11.5,12.3,.02,.13,M.yellow);rod(panel,[0,11.65,.2],[0,12.2,.2],.1,M.red);}
    }
    let lastBellowsX=NaN;
    const updateAxes=()=>{
      const xc=xG.position.x/K;if(xc===lastBellowsX)return;lastBellowsX=xc;
      for(const {mesh,sign,folds} of bellows){
        const edge=xc+sign*1.32,positions=mesh.geometry.attributes.position;
        for(let i=0;i<=folds;i++){
          const u=i/folds,z=1.91+(i%2?.06:0);
          const lower=sign<0?THREE.MathUtils.lerp(-6.83,edge,u):THREE.MathUtils.lerp(edge,6.83,u);
          const upper=sign<0?THREE.MathUtils.lerp(-8.56,edge,u):THREE.MathUtils.lerp(edge,8.56,u);
          positions.setXYZ(i*2,lower,17.19,z);positions.setXYZ(i*2+1,upper,23.08,z);
        }
        positions.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();
      }
    };
    updateAxes();
    const updateGeometry=({doorK,panelA=0,panelYaw=0})=>{
      doors.forEach(d=>d.position.set(d.userData.s*(leaf/2+doorK*opening/2),0,front+.54));
      const pose=hmiPose(panelA*180/Math.PI,panelYaw*180/Math.PI,bodyHalf,1);
      armPivot.rotation.y=pose.angle;armElbow.rotation.y=pose.elbow;panG.rotation.y=pose.yaw-pose.angle-pose.elbow;
      const centre=yG.position.z, limits=[[-10.8,centre-2],[centre+2,6.5]];
      roofCovers.forEach((mesh,i)=>{const [lo,hi]=limits[i];mesh.scale.z=Math.max(.01,hi-lo);mesh.position.z=(hi+lo)/2;});
    };
    updateGeometry({doorK:1});
    const lighting={scale:1,halfWidth:bodyHalf,workHeight:9.5,bounds:[[-bodyHalf+.3,5.8,rear+.3],[bodyHalf-.3,P.roof-.1,front-.25]],lampPositions:[[-5.2,20.3,1],[5.2,20.3,1]]};
    const anchorOverrides={
      kabina:()=>v3(-bodyHalf+1,P.roof-.5,front),
      lozko:()=>v3(bodyHalf-1,3,7.8),
      osi:()=>v3(8.6*K,22.8,yG.position.z),
      stol:()=>v3(-5*K,PY-2,2),
      panel:()=>new THREE.Vector3(0,15,0).applyMatrix4(panG.matrixWorld),
    };
    const viewOverrides={
      celok:()=>[[39,28,46],[0,13,-4],false],
      panel:()=>{const p=new THREE.Vector3(0,13,0).applyMatrix4(panG.matrixWorld),direction=new THREE.Vector3(3,3,16).transformDirection(panG.matrixWorld).multiplyScalar(18);return [p.clone().add(direction).toArray(),p.toArray(),true];},
      spredu:()=>[[0,16,48],[0,14,0],false],
      zhora:()=>[[.01,78,-6],[0,9,-6],true],
    };
    // Hundreds of immobile jaws, screws and teeth share a handful of draw calls.
    // Pocket groups remain separate so tool loading/indexing keeps its real poses.
    for(const group of [magG,drum,saddle])batchStaticMeshes(group);
    return {profile:P,doorTravel:opening/2,updateGeometry,updateAxes,lighting,viewOverrides,anchorOverrides,cab,aG,cG,yG,xG,zG,sp,toolG,buildTool,pockets,magG,driveShaft,saddle,magY,magZ,panG,armPivot,armElbow,hmi,sm,covers,clampPins,doors,loadMagazine,accessories};

}

function batchStaticMeshes(group){
  group.updateWorldMatrix(true,true);
  const inverse=group.matrixWorld.clone().invert(),byMaterial=new Map(),meshes=[];
  group.traverse(mesh=>{if(mesh.isMesh&&!Array.isArray(mesh.material))meshes.push(mesh);});
  for(const mesh of meshes){
    const transform=inverse.clone().multiply(mesh.matrixWorld),copies=[];
    if(mesh.isInstancedMesh){
      for(let i=0;i<mesh.count;i++){const instance=new THREE.Matrix4();mesh.getMatrixAt(i,instance);copies.push(transform.clone().multiply(instance));}
    }else copies.push(transform);
    const list=byMaterial.get(mesh.material)||[];
    for(const matrix of copies){const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geometry.applyMatrix4(matrix);list.push(geometry);}
    byMaterial.set(mesh.material,list);mesh.removeFromParent();mesh.geometry.dispose();if(mesh.isInstancedMesh)mesh.dispose();
  }
  for(const [material,parts] of byMaterial){
    const merged=mergeGeometries(parts),mesh=new THREE.Mesh(merged,material);mesh.name='batched-static-detail';mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);parts.forEach(g=>g.dispose());
  }
}
