// Výber a zvýraznenie dielov, popisy v scéne, predvolené pohľady.
import * as THREE from 'three';
import { createOrbit } from './stage';
import { clamp } from './util';

// ---------- výber a zvýraznenie dielov, popisy, predvolené pohľady ----------
function createInspector({
  dom,
  mount,
  camera,
  root,
  G,
  anchors,
  labelEls,
  views,
  enabled,
  onPick,
  blockPick,
  onHL,
  orbitOptions,
}) {
  const tween = { active: false };
  let now = 0;
  const orbit = createOrbit(
    camera,
    dom,
    () => {
      tween.active = false;
    },
    enabled,
    orbitOptions,
  );
  const viewFactor = () => clamp(1.65 / camera.aspect, 1, 2.3);
  const goView = (name, instant) => {
    const [p, tg, fixed] = views[name]();
    const tt = new THREE.Vector3(...tg);
    const tp = new THREE.Vector3(...p)
      .sub(tt)
      .multiplyScalar(fixed ? 1 : viewFactor())
      .add(tt);
    if (instant) {
      tween.active = false;
      camera.position.copy(tp);
      orbit.target.copy(tt);
      orbit.sync();
      orbit.apply();
      return;
    }
    Object.assign(tween, {
      active: true,
      t0: now,
      dur: 0.9,
      fp: camera.position.clone(),
      ft: orbit.target.clone(),
      tp,
      tt,
    });
  };

  const ray = new THREE.Raycaster();
  let downAt = null;
  const onDown = (e) => {
    downAt = [e.clientX, e.clientY];
  };
  const onUp = (e) => {
    if (!downAt) return;
    if (blockPick() || !enabled()) {
      downAt = null;
      return;
    } // klik na ovládací prvok ani ručné ovládanie nevyberá časť
    const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
    downAt = null;
    if (moved > 5) return;
    const rect = dom.getBoundingClientRect();
    camera.updateMatrixWorld();
    ray.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    let key = null;
    for (const h of ray.intersectObjects(root.children, true)) {
      let o = h.object;
      while (o && !o.userData.part) o = o.parent;
      if (o) {
        key = o.userData.part;
        break;
      }
    }
    onPick(key);
  };
  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('pointerup', onUp);

  let hlKey = null,
    hlMeshes = [];
  const applyHL = (key) => {
    hlMeshes.forEach((m) => {
      m.material.dispose();
      m.material = m.userData.om;
    });
    hlMeshes = [];
    hlKey = key;
    if (key && G[key]) {
      G[key].traverse((o) => {
        if (!o.isMesh || o.userData.mergedInto) return; // skrytá pôvodná sieť zlúčenej skupiny
        let p = o;
        while (p && !p.userData.part) p = p.parent;
        if (!p || p.userData.part !== key) return;
        o.userData.om = o.material;
        const m2 = o.material.clone();
        if (m2.emissive) m2.emissive.setHex(0xff8a1f);
        o.material = m2;
        hlMeshes.push(o);
      });
    }
    onHL();
  };

  const update = (t, c) => {
    now = t;
    // v ručnom ovládaní sa vybraná časť nezvýrazňuje – svietia len ovládacie prvky
    const want = c.manual || c.unclamped ? null : c.highlight;
    if (want !== hlKey) applyHL(want);
    if (hlMeshes.length) {
      const k = 0.3 + 0.22 * Math.sin(t * 5);
      hlMeshes.forEach((m) => {
        if (m.material.emissive) m.material.emissiveIntensity = k;
      });
    }
    if (tween.active) {
      const k = Math.min(1, (t - tween.t0) / tween.dur),
        e = k * k * (3 - 2 * k);
      camera.position.lerpVectors(tween.fp, tween.tp, e);
      orbit.target.lerpVectors(tween.ft, tween.tt, e);
      camera.lookAt(orbit.target);
      if (k >= 1) {
        tween.active = false;
        orbit.sync();
      }
    }
    // popisy: celé pixely a zmena štýlu len pri skutočnej zmene – inak text pri pohybe kamery bliká
    if (c.labels && !c.manual && !c.unclamped) {
      const w = mount.clientWidth,
        h = mount.clientHeight;
      camera.updateMatrixWorld();
      for (const el of labelEls) {
        const v = anchors[el.dataset.part]().project(camera);
        const vis = !(v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1);
        if (el._vis !== vis) {
          el._vis = vis;
          el.style.visibility = vis ? 'visible' : 'hidden';
          el.style.pointerEvents = vis ? 'auto' : 'none';
        }
        if (!vis) continue;
        const px = Math.round(((v.x + 1) / 2) * w - el.offsetWidth / 2),
          py = Math.round(((1 - v.y) / 2) * h - el.offsetHeight * 1.3);
        if (el._px !== px || el._py !== py) {
          el._px = px;
          el._py = py;
          el.style.transform = `translate3d(${px}px, ${py}px, 0)`;
        }
      }
    }
  };
  const pose = () => ({ p: camera.position.clone(), t: orbit.target.clone() });
  const flyTo = (p, tg) => {
    Object.assign(tween, {
      active: true,
      t0: now,
      dur: 0.9,
      fp: camera.position.clone(),
      ft: orbit.target.clone(),
      tp: p.clone(),
      tt: tg.clone(),
    });
  };
  const dispose = () => {
    orbit.dispose();
    dom.removeEventListener('pointerdown', onDown);
    dom.removeEventListener('pointerup', onUp);
    hlMeshes.forEach((m) => {
      m.material.dispose();
      m.material = m.userData.om;
    });
    hlMeshes = [];
  };
  return { goView, update, pose, flyTo, hl: () => hlMeshes, dispose };
}

export { createInspector };
