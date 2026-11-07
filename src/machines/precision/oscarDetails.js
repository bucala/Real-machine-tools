import * as THREE from 'three';

// Closed, hollow rubber boot. Every fold shares its edge with its neighbour;
// scaling the unit-height mesh compresses the folds without opening gaps.
export function accordionGeometry(width,depth,folds=28){
  const pos=[],idx=[],rings=folds*2+1;
  for(let inside=0;inside<2;inside++)for(let i=0;i<rings;i++){
    const inset=(i%2?.11:0)+inside*.045,x=width/2-inset,z=depth/2-inset,y=i/(rings-1);
    for(const [a,b] of [[-x,-z],[-x,z],[x,z],[x,-z]])pos.push(a,y,b);
  }
  const quad=(a,b,c,d)=>idx.push(a,b,c,a,c,d);
  for(let i=0;i<rings-1;i++)for(let j=0;j<4;j++){
    const a=i*4+j,b=i*4+(j+1)%4,c=b+4,d=a+4,off=rings*4;
    quad(a,b,c,d);quad(a+off,d+off,c+off,b+off);
  }
  for(const i of [0,rings-1])for(let j=0;j<4;j++){
    const a=i*4+j,b=i*4+(j+1)%4,c=b+rings*4,d=a+rings*4;
    if(i===0)quad(a,d,c,b);else quad(a,b,c,d);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);
  const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();return flat;
}

export function oscarDecals(tex){
  const plane=(texture,w,h)=>new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,transparent:true,toneMapped:false,depthWrite:false}));
  const logo=tex(512,768,(g,w,h)=>{
    g.clearRect(0,0,w,h);
    // Parallel diagonal ribbons, as printed on the narrow EX-series column.
    const levels=[[-120,210,'#f5df32'],[210,315,'#f3f4f3'],[315,415,'#a4acb8'],[415,510,'#144b9f'],[510,660,'#f4df32']];
    for(const [a,b,color] of levels){g.fillStyle=color;g.beginPath();g.moveTo(0,a);g.lineTo(w,a-120);g.lineTo(w,b-120);g.lineTo(0,b);g.closePath();g.fill();}
    g.save();g.translate(w/2,536);g.rotate(-Math.atan2(120,w));g.fillStyle='#121715';g.font='900 56px Arial, sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('OSCARMAX',0,0,460);g.restore();
  });
  const ex=tex(640,150,(g,w,h)=>{
    g.fillStyle='#202529';g.fillRect(0,0,w,h);g.font='italic 900 116px Arial, sans-serif';g.textBaseline='middle';
    g.fillStyle='#f7f8f6';g.fillText('EX',24,h/2+4);g.fillStyle='#ef2639';g.fillText('500',210,h/2+4);
  });
  const safety=tex(1024,220,(g,w,h)=>{
    g.fillStyle='#eeede6';g.fillRect(0,0,w,h);g.fillStyle='#bd1726';g.fillRect(0,0,w,34);g.font='bold 22px Arial';g.fillStyle='#fff';g.fillText('CAUTION  ·  EDM WORK AREA',18,25);
    for(let i=0;i<5;i++){
      const x=22+i*204;g.strokeStyle='#92968f';g.lineWidth=2;g.strokeRect(x-8,42,195,170);
      if(i<2){g.strokeStyle='#bc1e2b';g.lineWidth=10;g.beginPath();g.arc(x+45,112,42,0,Math.PI*2);g.stroke();g.beginPath();g.moveTo(x+15,81);g.lineTo(x+75,143);g.stroke();}
      else{g.fillStyle='#efc72e';g.beginPath();g.moveTo(x+44,64);g.lineTo(x+90,149);g.lineTo(x,149);g.closePath();g.fill();g.lineWidth=4;g.strokeStyle='#25272a';g.stroke();}
      g.fillStyle='#1e2427';g.font='bold 50px Arial';g.fillText(i===3?'ϟ':'!',x+35,133);
      for(let n=0;n<5;n++){g.fillRect(x+103,72+n*16,70-(n%2)*12,4);}g.fillRect(x+4,173,173,4);g.fillRect(x+4,187,140,3);
    }
  });
  const plate=tex(512,256,(g,w,h)=>{
    g.fillStyle='#aeb4b7';g.fillRect(0,0,w,h);g.strokeStyle='#394346';g.lineWidth=7;g.strokeRect(10,10,w-20,h-20);
    g.fillStyle='#202b30';g.font='900 48px Arial';g.fillText('OSCARMAX',30,69);g.font='24px Arial';g.fillText('ELECTRICAL DISCHARGE MACHINE',30,106);
    g.font='bold 32px Arial';g.fillText('EX 500',30,157);g.font='23px Arial';g.fillText('60 A   /   10 kVA',30,200);g.font='bold 30px Arial';g.fillText('EDM',400,202);
  });
  return {
    column:()=>plane(logo.tx,3.04,4.56),
    model:()=>plane(ex.tx,1.9,.445),
    safety:()=>plane(safety.tx,3.55,.76),
    plate:()=>plane(plate.tx,1.55,.775),
  };
}
