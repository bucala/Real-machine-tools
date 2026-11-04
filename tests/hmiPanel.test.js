import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createHmiPanel } from '../src/machines/cnc/hmiPanel';

describe('TNC console geometry', () => {
  it('uses a landscape LCD and seats raised keys on the same inclined plane as the controls', () => {
    const parent=new THREE.Group(),mat=new THREE.MeshStandardMaterial();
    const M=Object.fromEntries(['brush','cab2','black','steelD','steel','red','yellow','cab','anth'].map(k=>[k,mat]));
    const panel=createHmiPanel(parent,M);
    expect(panel.display.geometry.parameters.width/panel.display.geometry.parameters.height).toBeGreaterThan(1.45);
    expect(panel.monitor.rotation.x).toBeLessThan(0);
    expect(panel.deck.rotation.x).toBeCloseTo(20*Math.PI/180);
    for(const mesh of Object.values(panel.instances)){
      for(let i=0;i<mesh.count;i++){
        const matrix=new THREE.Matrix4();mesh.getMatrixAt(i,matrix);
        const p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();matrix.decompose(p,q,s);
        expect(p.y-s.y/2).toBeCloseTo(.07,5);
      }
    }
    // Keep distinct banks from physically intersecting one another.
    for(let i=0;i<panel.keys.length;i++)for(let j=i+1;j<panel.keys.length;j++){
      const a=panel.keys[i],b=panel.keys[j];
      expect(Math.abs(a.x-b.x)>=(a.w+b.w)/2-.001||Math.abs(a.z-b.z)>=(a.d+b.d)/2-.001).toBe(true);
    }
    parent.updateMatrixWorld(true);
    expect(new THREE.Box3().setFromObject(parent).min.y).toBeGreaterThan(8);
    parent.traverse(o=>o.geometry?.dispose());mat.dispose();
  });
});
