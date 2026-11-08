import * as THREE from 'three';
export function modelKit(root, M, tex) {
  const group = (name, parent = root) => {
    const g = new THREE.Group();
    g.name = name;
    parent.add(g);
    return g;
  };
  const box = (p, x, y, z, w, h, d, m = M.cab) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    p.add(o);
    return o;
  };
  const cyl = (p, x, y, z, r, h, m = M.steel, axis = 'y', r2 = r) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, h, 40), m);
    o.position.set(x, y, z);
    if (axis === 'x') o.rotation.z = Math.PI / 2;
    if (axis === 'z') o.rotation.x = Math.PI / 2;
    o.castShadow = true;
    o.receiveShadow = true;
    p.add(o);
    return o;
  };
  const rod = (p, a, b, r, m = M.steel) => {
    const v = new THREE.Vector3(...a),
      q = new THREE.Vector3(...b),
      d = q.clone().sub(v),
      o = cyl(p, 0, 0, 0, r, d.length(), m);
    o.position.copy(v).add(q).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return o;
  };
  const label = (p, text, x, y, z, w, h, { color = '#a21832', background = '#e6e8ea', rotate = 0, size = 46 } = {}) => {
    const t = tex(768, 192, (g, W, H) => {
      g.fillStyle = background;
      g.fillRect(0, 0, W, H);
      g.fillStyle = color;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `bold ${size}px sans-serif`;
      g.fillText(text, W / 2, H / 2, W - 30);
    });
    const o = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: t.tx, toneMapped: false }),
    );
    o.position.set(x, y, z);
    o.rotation.y = rotate;
    p.add(o);
    return o;
  };
  const bolts = (p, x, y, z, w, h) => {
    for (const s of [-1, 1])
      for (const t of [-1, 1]) cyl(p, x + (s * w) / 2, y + (t * h) / 2, z, 0.045, 0.035, M.steelD, 'z');
  };
  const clear = (g) => {
    while (g.children.length) {
      const o = g.children[0];
      g.remove(o);
      o.traverse((n) => n.geometry?.dispose());
    }
  };
  return { group, box, cyl, rod, label, bolts, clear };
}
