import { it,expect } from 'vitest';
import { compileEdmGcode,EDM_GCODE_SAMPLE } from '../src/machines/precision/edmGcode';
import { createEdmProcess } from '../src/machines/precision/edmProcess';
import { createStock } from '../src/machines/cnc/voxel';
import { readElectrodes,parseElectrodes,defaultElectrodes,ELECTRODE_KEY } from '../src/machines/precision/electrodes';
it('compiles absolute and incremental EDM programs with feed and source block numbers',()=>{
 const result=compileEdmGcode(EDM_GCODE_SAMPLE);expect(result).toMatchObject({startFlushing:true,endFlushing:false,endLine:12});expect(result.rows).toEqual([{x:-20,y:0,depth:8,line:6,feed:3},{x:20,y:0,depth:5,line:9,feed:3}]);
 expect(compileEdmGcode('G21 G90\nG0 X10 Y5\nG91\nG1 Z-7 F1\nG90 G0 Z5\nM30').rows[0]).toMatchObject({x:10,y:5,depth:2,feed:1});
});
it('rejects unsupported, unsafe and malformed NC without partially returning a job',()=>{
 for(const code of ['G2 X0 Y0','G20','G0 Z-5','G1 Z-5\nG0 X10','G1 Z-5\nM30','G1 Z-5\nG1 Z-8\nG0 Z5','M5\nG1 Z-4\nG0 Z5','M9\nG1 Z-4\nG0 Z5','G1 Z-5 F0\nG0 Z5','G1 Z-5 F200\nG0 Z5','G1 Z-5 #1\nG0 Z5'])expect(()=>compileEdmGcode(code)).toThrow(/NC/);
 expect(()=>compileEdmGcode('G21\nG2 X1')).toThrow(/NC 2/);
});
it('runs a compiled NC program through actual stock removal, preserving a paused cut',()=>{
 const stock=createStock({min:[-50,-40,0],max:[50,40,30],res:1}),p=createEdmProcess(stock),rows=compileEdmGcode('G90\nG0 X0 Y0\nG1 Z-2 F3\nG0 Z5\nM30').rows;
 expect(p.start({rows,electrode:{shape:'box',w:8,d:8,length:100,material:'graphite'},current:60,gap:.05,oilLevel:80,fixtureHeight:50})).toBe(true);
 p.advance(15,{oilLevel:80});p.hold();const removed=stock.removed();expect(removed).toBeGreaterThan(0);p.advance(20,{oilLevel:80});expect(stock.removed()).toBe(removed);
 expect(p.S.line).toBe(3);p.start(p.job);p.advance(100,{oilLevel:80});expect(p.S.done).toBe(true);expect(stock.removed()).toBeGreaterThan(removed);
});
it('adds four graphite sizes to existing cabinets and retains material on JSON import',()=>{
 const old=JSON.stringify({version:1,electrodes:[defaultElectrodes()[0]]}),items=readElectrodes({getItem:k=>k===ELECTRODE_KEY?old:null}),graphite=items.filter(e=>e.material==='graphite');
 expect(graphite).toHaveLength(4);expect(new Set(graphite.map(e=>e.w+'x'+e.d)).size).toBe(4);expect(parseElectrodes({version:1,electrodes:graphite})).toEqual(graphite);expect(items[0].id).toBe('copper-prism-20-15');
 expect(()=>parseElectrodes({version:1,electrodes:[{...graphite[0],material:'invalid'}]})).toThrow();
});
