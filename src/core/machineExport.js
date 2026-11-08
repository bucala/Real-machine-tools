import * as THREE from 'three';

const WORKPIECES = new Set(['obrobok', 'plech', 'profil', 'pas', 'zvarenec']);
export const modelFilename = (name) =>
  (name || 'machine')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'machine';
const drawable = (m) => m && m.visible !== false && m.colorWrite !== false && m.opacity !== 0;

// Take a synchronous copy of the current pose. Only these copies are transferred
// to the worker; neither animation nor the live renderer's buffers are touched.
export function snapshotMachine(root) {
  if (!root) throw new Error('Machine model is not ready.');
  root.updateWorldMatrix(true, true);
  const meshes = [],
    bounds = new THREE.Box3(),
    v = new THREE.Vector3(),
    n = new THREE.Vector3();
  const visit = (o, path) => {
    if (!o.visible || o.userData.excludeFromMachineExport || WORKPIECES.has(o.userData.part)) return;
    const label = o.name || o.userData.part;
    const nextPath = label ? [...path, modelFilename(label)] : path;
    if (o.isMesh && o.geometry?.attributes.position && !o.userData.stepSubtract) {
      const geo = o.geometry,
        pos = geo.attributes.position,
        norm = geo.attributes.normal;
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      const count = geo.index ? geo.index.count : pos.count;
      const start = Math.max(0, geo.drawRange.start),
        end = Math.min(count, start + geo.drawRange.count);
      const indices = [];
      for (let i = start; i + 2 < end; i += 3) {
        const group = Array.isArray(o.material)
          ? geo.groups.find((g) => i >= g.start && i + 2 < g.start + g.count)
          : null;
        if (Array.isArray(o.material) && !group) continue;
        if (!drawable(materials[group?.materialIndex || 0])) continue;
        for (let j = 0; j < 3; j++) indices.push(geo.index ? geo.index.getX(i + j) : i + j);
      }
      const used = [...new Set(indices)],
        remap = new Map(used.map((vertex, i) => [vertex, i]));
      if (indices.length)
        for (let instance = 0; instance < (o.isInstancedMesh ? o.count : 1); instance++) {
          const matrix = o.matrixWorld.clone();
          if (o.isInstancedMesh) {
            const local = new THREE.Matrix4();
            o.getMatrixAt(instance, local);
            matrix.multiply(local);
          }
          if (Math.abs(matrix.determinant()) < 1e-12) continue;
          const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
          const positions = new Float32Array(used.length * 3),
            normals = norm ? new Float32Array(used.length * 3) : null;
          for (let i = 0; i < used.length; i++) {
            v.fromBufferAttribute(pos, used[i])
              .applyMatrix4(matrix)
              .toArray(positions, i * 3);
            if (norm)
              n.fromBufferAttribute(norm, used[i])
                .applyNormalMatrix(normalMatrix)
                .toArray(normals, i * 3);
          }
          // Some thin panels are rendered with two coincident, opposite faces.
          // CAD sewing interprets those as conflicting surfaces and can inflate
          // tolerances by metres. Keep a single surface, regardless of winding.
          const faces = new Set(),
            uniqueIndices = [];
          for (let i = 0; i < indices.length; i += 3) {
            const tri = indices.slice(i, i + 3).map((vertex) => remap.get(vertex));
            const points = tri.map((vertex) => positions.subarray(vertex * 3, vertex * 3 + 3).join(','));
            if (new Set(points).size < 3) continue;
            const key = points.sort().join('|');
            if (faces.has(key)) continue;
            faces.add(key);
            uniqueIndices.push(...tri);
          }
          if (!uniqueIndices.length) continue;
          const index = new Uint32Array(uniqueIndices);
          // A mirrored transform reverses winding. Preserve outward CAD normals.
          if (matrix.determinant() < 0)
            for (let i = 0; i < index.length; i += 3) [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]];
          for (const i of index) bounds.expandByPoint(v.fromArray(positions, i * 3));
          meshes.push({ name: `${nextPath.join('__') || 'part'}_${meshes.length + 1}`, positions, normals, index });
        }
    }
    o.children.forEach((child) => visit(child, nextPath));
  };
  visit(root, []);
  if (!meshes.length) throw new Error('No visible machine geometry is available.');
  // Same origin for every format: centre of the machine's footprint, bottom Y=0.
  const center = bounds.getCenter(new THREE.Vector3());
  for (const mesh of meshes)
    for (let i = 0; i < mesh.positions.length; i += 3) {
      mesh.positions[i] -= center.x;
      mesh.positions[i + 1] -= bounds.min.y;
      mesh.positions[i + 2] -= center.z;
    }
  return meshes;
}

export function exportMachineModel(model, format, signal) {
  if (!['obj', 'stl', 'stp'].includes(format)) return Promise.reject(new Error('Unsupported model format.'));
  if (signal?.aborted) return Promise.reject(new DOMException('Export cancelled', 'AbortError'));
  const meshes = snapshotMachine(model?.root);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./machineExport.worker.js', import.meta.url), { type: 'module' });
    const cleanup = () => {
      worker.terminate();
      signal?.removeEventListener('abort', abort);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException('Export cancelled', 'AbortError'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }) => {
      cleanup();
      if (data.error) reject(new Error(data.error));
      else resolve(data.blob);
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error('Export worker failed.'));
    };
    try {
      const transfer = meshes.flatMap((m) => [
        m.positions.buffer,
        m.index.buffer,
        ...(m.normals ? [m.normals.buffer] : []),
      ]);
      worker.postMessage({ meshes, format, name: modelFilename(model.name) }, transfer);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
