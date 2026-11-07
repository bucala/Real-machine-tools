import * as THREE from 'three';
// A separate locked camera renders the same live scene. No controls, machine
// state or main-camera pose are changed while this viewer is open.
export function workAreaFeed({scene,camera,renderer,view}){
  return canvas=>{
    const detail=camera.clone(),out=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
    out.setPixelRatio(1);out.setSize(800,500,false);out.outputColorSpace=renderer.outputColorSpace;out.toneMapping=renderer.toneMapping;out.toneMappingExposure=renderer.toneMappingExposure;
    detail.aspect=800/500;detail.updateProjectionMatrix();
    let disposed=false;
    return {render(){if(disposed)return;const [p,target]=view();detail.position.fromArray(p);detail.lookAt(new THREE.Vector3(...target));detail.updateMatrixWorld();out.render(scene,detail);},dispose(){disposed=true;out.dispose();out.forceContextLoss();}};
  };
}
