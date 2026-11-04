import { L } from './i18n';
import { createWorkInspect } from './workInspect';

// Shared entry/exit guards for machines whose simulation pauses while a part is out.
export function createMachineWorkInspect({ scene, camera, dom, insp, c, set, apiRef, getObj, getSpot, canInspect, say, prepare, restore, canDetach }) {
  let manual = false;
  const wi = createWorkInspect({ scene, camera, dom, insp, c, getObj, getSpot, canDetach,
    onState: value => {
      set('unclamped', value);
      set('manual', value ? false : manual);
      if (!value) restore?.();
    } });
  apiRef.current.toggleWork = () => {
    if (wi.phase() === 'in') {
      const reason = canInspect();
      if (reason) { say(reason); return; }
      const obj = getObj();
      if (!obj || (!obj.isMesh && !obj.children.length)) { say(L('Nie je dostupný obrobok na prehliadku.', 'No workpiece is available to inspect.')); return; }
      manual = c.manual;
      prepare?.();
    }
    if (!wi.toggle()) say(L('Počkaj na dokončenie pohybu obrobku.', 'Wait until the workpiece movement finishes.'));
  };
  apiRef.current.view = name => { if (!c.unclamped) insp.goView(name, false); };
  return wi;
}
