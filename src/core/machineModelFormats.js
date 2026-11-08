import * as THREE from 'three';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { exportStep } from './step';

export async function serializeMachineModel({ meshes, name, format }) {
  const root = new THREE.Group(),
    material = new THREE.MeshBasicMaterial();
  try {
    for (const data of meshes) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
      geometry.setIndex(new THREE.BufferAttribute(data.index, 1));
      if (data.normals) geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
      else geometry.computeVertexNormals();
      geometry.userData.exportName = data.name;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = data.name;
      root.add(mesh);
    }
    if (format === 'stp')
      return await exportStep(root, { name, description: 'Machine simulator model; faceted geometry in mm' });
    root.scale.setScalar(100);
    root.updateMatrixWorld(true);
    if (format === 'obj')
      return new Blob(
        [`# ${name}\n# Units: millimetres; Y up; separate named components\n`, new OBJExporter().parse(root)],
        { type: 'model/obj' },
      );
    if (format === 'stl') return new Blob([new STLExporter().parse(root, { binary: true })], { type: 'model/stl' });
    throw new Error('Unsupported model format.');
  } finally {
    root.traverse((o) => o.geometry?.dispose());
    material.dispose();
  }
}
