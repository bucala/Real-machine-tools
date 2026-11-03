// Export obrobku do STL (v mm) – na ďalšie spracovanie v CAD alebo na 3D tlač.
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

// obj = skupina alebo mesh obrobku v scéne; mierka scény 1 = 100 mm
function exportStl(obj) {
  if (!obj) return null;
  obj.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3());
  // kópia v mm, so stredom spodnej plochy v počiatku
  const root = new THREE.Group(); root.scale.setScalar(100); root.position.set(-c.x * 100, -box.min.y * 100, -c.z * 100);
  obj.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry) return;
    const m = new THREE.Mesh(o.geometry); m.matrixAutoUpdate = false; m.matrix.copy(o.matrixWorld); root.add(m);
  });
  root.updateMatrixWorld(true);
  const data = new STLExporter().parse(root, { binary: true });
  return new Blob([data], { type: 'model/stl' });
}

export { exportStl };
