import * as THREE from 'three';
// A separate locked camera renders the same live scene. No controls, machine
// state or main-camera pose are changed while this viewer is open.
export function workAreaFeed({ scene, camera, renderer, view, fov }) {
  return (canvas) => {
    const detail = camera.clone(),
      out = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    out.setPixelRatio(1);
    out.setSize(800, 500, false);
    out.outputColorSpace = renderer.outputColorSpace;
    out.toneMapping = renderer.toneMapping;
    out.toneMappingExposure = renderer.toneMappingExposure;
    if (fov) detail.fov = fov; // napr. širokouhlá kamera vnútri krytu stroja
    detail.aspect = 800 / 500;
    detail.updateProjectionMatrix();
    let disposed = false,
      width = 800,
      height = 500;
    return {
      render() {
        if (disposed) return;
        const bounds = canvas.getBoundingClientRect(),
          w = Math.max(160, Math.min(1280, Math.round(bounds.width) || 800)),
          h = Math.max(120, Math.min(900, Math.round(bounds.height) || 500));
        if (w !== width || h !== height) {
          width = w;
          height = h;
          out.setSize(w, h, false);
          detail.aspect = w / h;
          detail.updateProjectionMatrix();
        }
        const [p, target] = view();
        detail.position.fromArray(p);
        detail.lookAt(new THREE.Vector3(...target));
        detail.updateMatrixWorld();
        scene.updateMatrixWorld(true);
        out.render(scene, detail);
      },
      dispose() {
        disposed = true;
        out.dispose();
        out.forceContextLoss();
      },
    };
  };
}
