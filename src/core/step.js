// ISO 10303-21 / AP214 snapshot of the current workpiece in millimetres.
// Planar faces preserve the simulator's actual sampled geometry, including cuts.
import * as THREE from 'three';

const real = (n) => {
  const s = (Math.abs(n) < 1e-9 ? 0 : n).toPrecision(12).replace(/e/g, 'E');
  return s.includes('.') || s.includes('E') ? s : `${s}.`;
};
const refs = (ids) => ids.map((id) => `#${id}`).join(',');
const stepString = (text) =>
  String(text)
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/'/g, "''");

async function snapshot(obj) {
  obj.updateWorldMatrix(true, true);
  // Work close to the part origin so Float32 boolean geometry keeps micrometre
  // precision even when the machine stands many scene units from the origin.
  const origin = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
  const local = new THREE.Matrix4().makeTranslation(-origin.x, -origin.y, -origin.z);
  const positive = [],
    negative = [];
  obj.traverse((o) => {
    if (!o.isMesh || !o.geometry || o.userData.excludeFromExport) return;
    for (let p = o; p && p !== obj; p = p.parent) if (!p.visible) return;
    const geo = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(local, o.matrixWorld));
    (o.userData.stepSubtract ? negative : positive).push(geo);
  });
  if (!negative.length) {
    if (!obj.userData.stepJoin || positive.length < 2) return positive;
    // Voxel chunks share boundary vertices: join their topology before deciding
    // whether the workpiece is a closed CAD solid.
    const count = positive.reduce((n, g) => n + (g.index ? g.index.count : g.attributes.position.count), 0);
    const positions = new Float32Array(count * 3);
    let offset = 0;
    for (const geo of positive) {
      const n = geo.index ? geo.index.count : geo.attributes.position.count,
        p = geo.attributes.position;
      for (let i = 0; i < n; i++) {
        const j = geo.index ? geo.index.getX(i) : i;
        positions[offset++] = p.getX(j);
        positions[offset++] = p.getY(j);
        positions[offset++] = p.getZ(j);
      }
      geo.dispose();
    }
    return [new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3))];
  }
  const { Brush, Evaluator, SUBTRACTION } = await import('three-bvh-csg');
  const evaluator = new Evaluator();
  evaluator.attributes = ['position', 'normal'];
  evaluator.useGroups = false;
  evaluator.useCDTClipping = true;
  const cutters = negative.map((geo) => new Brush(geo));
  const out = positive.map((geo) => {
    let brush = new Brush(geo);
    for (const cutter of cutters) {
      brush.updateMatrixWorld();
      cutter.updateMatrixWorld();
      const next = evaluator.evaluate(brush, cutter, SUBTRACTION);
      brush.geometry.dispose();
      brush = next;
    }
    return brush.geometry;
  });
  negative.forEach((g) => g.dispose());
  return out;
}

export async function exportStep(
  obj,
  { name = 'workpiece', description = 'Current machined workpiece; faceted geometry in mm' } = {},
) {
  if (!obj) return null;
  const geometries = await snapshot(obj),
    bounds = new THREE.Box3(),
    v = new THREE.Vector3();
  for (const geo of geometries) {
    geo.computeBoundingBox();
    bounds.union(geo.boundingBox);
  }
  if (bounds.isEmpty()) {
    geometries.forEach((g) => g.dispose());
    return null;
  }
  const center = bounds.getCenter(new THREE.Vector3()),
    shift = new THREE.Vector3(center.x, bounds.min.y, center.z);
  const lines = [],
    add = (value) => {
      lines.push(`#${lines.length + 1}=${value};`);
      return lines.length;
    };
  const app = add("APPLICATION_CONTEXT('automotive_design')");
  add(`APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#${app})`);
  const pc = add(`PRODUCT_CONTEXT('',#${app},'mechanical')`),
    product = add(`PRODUCT('${stepString(name)}','${stepString(name)}','${stepString(description)}',(#${pc}))`);
  const form = add(`PRODUCT_DEFINITION_FORMATION('1','',#${product})`),
    dc = add(`PRODUCT_DEFINITION_CONTEXT('part definition',#${app},'design')`);
  const pd = add(`PRODUCT_DEFINITION('design','',#${form},#${dc})`),
    ps = add(`PRODUCT_DEFINITION_SHAPE('','',#${pd})`);
  const length = add('(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))'),
    angle = add('(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))');
  const solidAngle = add('(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())');
  const tolerance = add(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-4),#${length},'distance_accuracy_value','')`);
  const context = add(
    `(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${tolerance}))GLOBAL_UNIT_ASSIGNED_CONTEXT((#${length},#${angle},#${solidAngle}))REPRESENTATION_CONTEXT('','3D'))`,
  );
  const shapes = [],
    a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3(),
    edge = new THREE.Vector3(),
    normal = new THREE.Vector3();
  for (const geo of geometries) {
    const points = [],
      pointIds = [],
      pointMap = new Map(),
      faces = [],
      parents = [],
      edges = new Map();
    const find = (i) => {
      while (parents[i] !== i) {
        parents[i] = parents[parents[i]];
        i = parents[i];
      }
      return i;
    };
    const vertex = (index) => {
      v.fromBufferAttribute(geo.attributes.position, index).sub(shift).multiplyScalar(100);
      const xyz = v.toArray().map((n) => Math.round(n * 1e4) / 1e4),
        key = xyz.join(',');
      if (pointMap.has(key)) return pointMap.get(key);
      const i = points.length;
      points.push(xyz);
      pointIds.push(add(`CARTESIAN_POINT('',(${xyz.map(real).join(',')}))`));
      pointMap.set(key, i);
      return i;
    };
    const count = geo.index ? geo.index.count : geo.attributes.position.count;
    for (let k = 0; k + 2 < count; k += 3) {
      const ids = [0, 1, 2].map((j) => vertex(geo.index ? geo.index.getX(k + j) : k + j));
      a.fromArray(points[ids[0]]);
      b.fromArray(points[ids[1]]);
      c.fromArray(points[ids[2]]);
      edge.subVectors(b, a);
      normal.subVectors(c, a).cross(edge).negate();
      if (normal.lengthSq() < 1e-18) continue;
      normal.normalize();
      edge.normalize();
      const direction = add(`DIRECTION('',(${normal.toArray().map(real).join(',')}))`),
        x = add(`DIRECTION('',(${edge.toArray().map(real).join(',')}))`);
      const axis = add(`AXIS2_PLACEMENT_3D('',#${pointIds[ids[0]]},#${direction},#${x})`),
        plane = add(`PLANE('',#${axis})`);
      const loop = add(`POLY_LOOP('',(${refs(ids.map((i) => pointIds[i]))}))`),
        bound = add(`FACE_OUTER_BOUND('',#${loop},.T.)`);
      const fi = faces.length;
      parents.push(fi);
      faces.push({ id: add(`FACE_SURFACE('',(#${bound}),#${plane},.T.)`), closed: true });
      for (let j = 0; j < 3; j++) {
        const p = ids[j],
          q = ids[(j + 1) % 3],
          key = p < q ? `${p},${q}` : `${q},${p}`,
          sign = p < q ? 1 : -1;
        const e = edges.get(key);
        if (e) {
          parents[find(fi)] = find(e.face);
          e.count++;
          e.sign += sign;
        } else edges.set(key, { face: fi, count: 1, sign });
      }
    }
    for (const e of edges.values()) if (e.count !== 2 || e.sign !== 0) faces[find(e.face)].closed = false;
    const groups = new Map();
    faces.forEach((face, i) => {
      const root = find(i);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(face.id);
    });
    for (const [root, ids] of groups) {
      const closed = faces[root].closed,
        shell = add(`${closed ? 'CLOSED' : 'OPEN'}_SHELL('',(${refs(ids)}))`);
      const label = stepString(geo.userData.exportName || '');
      shapes.push(
        add(closed ? `FACETED_BREP('${label}',#${shell})` : `SHELL_BASED_SURFACE_MODEL('${label}',(#${shell}))`),
      );
    }
    geo.dispose();
  }
  if (!shapes.length) return null;
  const rep = add(`SHAPE_REPRESENTATION('',(${refs(shapes)}),#${context})`);
  add(`SHAPE_DEFINITION_REPRESENTATION(#${ps},#${rep})`);
  return new Blob(
    [
      `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('${stepString(description)}'),'2;1');\nFILE_NAME('${stepString(name)}.stp','${new Date().toISOString()}',(''),(''),'Real machine tools','','');\nFILE_SCHEMA(('AUTOMOTIVE_DESIGN'));\nENDSEC;\nDATA;\n`,
      lines.join('\n'),
      '\nENDSEC;\nEND-ISO-10303-21;\n',
    ],
    { type: 'application/step' },
  );
}
